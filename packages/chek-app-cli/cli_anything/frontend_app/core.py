"""Core helpers for CHEK-APP-CLI."""

from __future__ import annotations

import json
import os
import re
import signal
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen


APP_CONFIG = Path("src/app.config.ts")
RUN_DIR = Path(".agent-harness/run")
PID_FILE = RUN_DIR / "h5.pid"
LOG_FILE = RUN_DIR / "h5.log"


class HarnessError(RuntimeError):
    """Error with agent-friendly details."""

    def __init__(self, message: str, *, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.details = details or {}


@dataclass(frozen=True)
class CommandResult:
    ok: bool
    command: str
    data: dict[str, Any] | list[Any] | str | None = None
    warnings: list[str] | None = None
    errors: list[str] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "command": self.command,
            "data": self.data if self.data is not None else {},
            "warnings": self.warnings or [],
            "errors": self.errors or [],
        }


def find_repo_root(repo: str | None = None) -> Path:
    """Resolve the CHEK app root from an explicit path, env, or cwd."""
    candidates: list[Path] = []
    if repo:
        candidates.append(Path(repo).expanduser())
    env_path = os.environ.get("FRONTEND_APP_PATH")
    if env_path:
        candidates.append(Path(env_path).expanduser())
    cwd = Path.cwd()
    candidates.extend([cwd, cwd.parent, Path(__file__).resolve().parents[3]])

    for candidate in candidates:
        root = candidate.resolve()
        if (root / "package.json").exists() and (root / APP_CONFIG).exists():
            return root

    raise HarnessError(
        "Could not locate CHEK app repository root.",
        details={
            "tried": [str(c.expanduser()) for c in candidates],
            "hint": "Pass --repo /path/to/frontend-app or set FRONTEND_APP_PATH for frontend-only helper commands.",
        },
    )


def package_json(repo_root: Path) -> dict[str, Any]:
    try:
        return json.loads((repo_root / "package.json").read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise HarnessError("package.json not found.", details={"repo": str(repo_root)}) from exc


def route_config(repo_root: Path) -> dict[str, Any]:
    path = repo_root / APP_CONFIG
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise HarnessError("src/app.config.ts not found.", details={"path": str(path)}) from exc

    entry = None
    entry_match = re.search(r"entryPagePath\s*:\s*['\"]([^'\"]+)['\"]", text)
    if entry_match:
        entry = entry_match.group(1)

    pages_match = re.search(r"pages\s*:\s*\[(.*?)\]", text, re.S)
    pages: list[str] = []
    if pages_match:
        pages = re.findall(r"['\"]([^'\"]+)['\"]", pages_match.group(1))

    return {
        "entryPagePath": entry,
        "pages": pages,
        "count": len(pages),
        "source": str(path),
    }


def h5_url(page_path: str, base_url: str, query: str | None = None) -> str:
    clean_base = base_url.rstrip("/")
    clean_path = normalize_page_path(page_path)
    suffix = f"?{query.lstrip('?')}" if query else ""
    return f"{clean_base}/#/{clean_path}{suffix}"


def normalize_page_path(page_path: str) -> str:
    return page_path.strip().lstrip("/")


def command_exists(command: str) -> str | None:
    try:
        completed = subprocess.run(
            ["which", command],
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
    except Exception:
        return None
    found = completed.stdout.strip()
    return found or None


def run_command(
    args: list[str],
    repo_root: Path,
    *,
    timeout: int = 120,
    env: dict[str, str] | None = None,
) -> dict[str, Any]:
    started = time.time()
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)

    try:
        completed = subprocess.run(
            args,
            cwd=str(repo_root),
            env=merged_env,
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        raise HarnessError(
            "Command timed out.",
            details={"args": args, "timeout": timeout, "stdout": exc.stdout, "stderr": exc.stderr},
        ) from exc

    return {
        "args": args,
        "cwd": str(repo_root),
        "returncode": completed.returncode,
        "duration_seconds": round(time.time() - started, 3),
        "stdout_tail": tail(completed.stdout),
        "stderr_tail": tail(completed.stderr),
    }


def tail(text: str | None, limit: int = 4000) -> str:
    if not text:
        return ""
    return text[-limit:]


def git_status(repo_root: Path) -> dict[str, Any]:
    branch = run_command(["git", "branch", "--show-current"], repo_root, timeout=10)
    status = run_command(["git", "status", "--short"], repo_root, timeout=10)
    remote = run_command(["git", "remote", "-v"], repo_root, timeout=10)
    return {
        "branch": branch["stdout_tail"].strip(),
        "dirty": bool(status["stdout_tail"].strip()),
        "status_short": status["stdout_tail"].splitlines(),
        "remotes": remote["stdout_tail"].splitlines(),
    }


def doctor(repo_root: Path) -> dict[str, Any]:
    pkg = package_json(repo_root)
    scripts = pkg.get("scripts", {})
    tools = {
        "node": command_exists("node"),
        "pnpm": command_exists("pnpm"),
        "npm": command_exists("npm"),
        "git": command_exists("git"),
    }
    route_info = route_config(repo_root)
    warnings: list[str] = []
    if not tools["pnpm"]:
        warnings.append("pnpm was not found; build and serve commands may fail.")
    if "dev:h5" not in scripts:
        warnings.append("package.json has no dev:h5 script.")
    if "build:h5" not in scripts:
        warnings.append("package.json has no build:h5 script.")
    return {
        "repo": str(repo_root),
        "package": {
            "name": pkg.get("name"),
            "version": pkg.get("version"),
            "private": pkg.get("private"),
            "packageManager": pkg.get("packageManager"),
        },
        "tools": tools,
        "scripts": {
            "dev:h5": scripts.get("dev:h5"),
            "build:h5": scripts.get("build:h5"),
        },
        "routes": {
            "entryPagePath": route_info["entryPagePath"],
            "count": route_info["count"],
        },
        "runtime": {
            "runDir": str(repo_root / RUN_DIR),
            "pidFile": str(repo_root / PID_FILE),
            "logFile": str(repo_root / LOG_FILE),
        },
        "warnings": warnings,
    }


def read_pid(repo_root: Path) -> int | None:
    pid_path = repo_root / PID_FILE
    if not pid_path.exists():
        return None
    try:
        return int(pid_path.read_text(encoding="utf-8").strip())
    except ValueError:
        return None


def is_process_alive(pid: int | None) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def serve_status(repo_root: Path) -> dict[str, Any]:
    pid = read_pid(repo_root)
    alive = is_process_alive(pid)
    return {
        "running": alive,
        "pid": pid,
        "pidFile": str(repo_root / PID_FILE),
        "logFile": str(repo_root / LOG_FILE),
    }


def start_h5_server(repo_root: Path, *, port: int, host: str, extra_args: tuple[str, ...]) -> dict[str, Any]:
    existing = serve_status(repo_root)
    if existing["running"]:
        return {**existing, "started": False, "message": "H5 server is already running."}

    run_dir = repo_root / RUN_DIR
    run_dir.mkdir(parents=True, exist_ok=True)
    log_path = repo_root / LOG_FILE
    env = os.environ.copy()
    env["H5_PORT"] = str(port)
    env.setdefault("HOST", host)
    args = ["pnpm", "dev:h5", *extra_args]

    log_file = log_path.open("a", encoding="utf-8")
    log_file.write(f"\n--- CHEK-APP-CLI serve h5 port={port} host={host} ---\n")
    log_file.flush()
    process = subprocess.Popen(
        args,
        cwd=str(repo_root),
        env=env,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        text=True,
        start_new_session=True,
    )
    (repo_root / PID_FILE).write_text(str(process.pid), encoding="utf-8")
    return {
        "started": True,
        "running": True,
        "pid": process.pid,
        "url": f"http://localhost:{port}/",
        "args": args,
        "env": {"H5_PORT": str(port), "HOST": host},
        "logFile": str(log_path),
        "pidFile": str(repo_root / PID_FILE),
    }


def stop_h5_server(repo_root: Path) -> dict[str, Any]:
    status = serve_status(repo_root)
    pid = status["pid"]
    if not status["running"] or not pid:
        return {**status, "stopped": False, "message": "No running H5 server tracked by the harness."}

    os.killpg(pid, signal.SIGTERM)
    for _ in range(20):
        if not is_process_alive(pid):
            break
        time.sleep(0.1)
    stopped = not is_process_alive(pid)
    if stopped:
        try:
            (repo_root / PID_FILE).unlink()
        except FileNotFoundError:
            pass
    return {**serve_status(repo_root), "stopped": stopped, "previousPid": pid}


def read_logs(repo_root: Path, lines: int) -> dict[str, Any]:
    log_path = repo_root / LOG_FILE
    if not log_path.exists():
        return {"logFile": str(log_path), "lines": []}
    content = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
    return {"logFile": str(log_path), "lines": content[-lines:]}


def http_smoke(url: str, timeout: float = 10.0) -> dict[str, Any]:
    request = Request(url, headers={"User-Agent": "CHEK-APP-CLI/0.1"})
    started = time.time()
    try:
        with urlopen(request, timeout=timeout) as response:
            body = response.read(512).decode("utf-8", errors="replace")
            return {
                "url": url,
                "status": response.status,
                "ok": 200 <= response.status < 400,
                "duration_seconds": round(time.time() - started, 3),
                "bodyPreview": body,
            }
    except URLError as exc:
        return {
            "url": url,
            "status": None,
            "ok": False,
            "duration_seconds": round(time.time() - started, 3),
            "error": str(exc),
        }


def wait_for_http(url: str, *, timeout: float, interval: float = 1.0) -> dict[str, Any]:
    """Poll a URL until it responds successfully or the timeout expires."""
    deadline = time.time() + timeout
    attempts = 0
    last = http_smoke(url, timeout=min(5.0, max(1.0, interval)))
    attempts += 1
    while not last.get("ok") and time.time() < deadline:
        time.sleep(interval)
        last = http_smoke(url, timeout=min(5.0, max(1.0, interval)))
        attempts += 1
    return {
        **last,
        "attempts": attempts,
        "waitedUntil": "ready" if last.get("ok") else "timeout",
        "timeout_seconds": timeout,
    }
