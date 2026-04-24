"""Backend API layer for CHEK-APP-CLI.

This follows the lark-cli shape: config/auth/raw API/domain shortcuts.
"""

from __future__ import annotations

import json
import os
import stat
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from .core import HarnessError


ENV_ORIGINS = {
    "dev": "https://api-dev.chekkk.com",
    "staging": "https://api-staging.chekkk.com",
    "prod": "https://api.chekkk.com",
}
IDENTITY_CHOICES = ("auto", "user", "service", "none")

CONFIG_DIR = Path(os.environ.get("CHEK_APP_CLI_HOME", "~/.chek-app-cli")).expanduser()
CONFIG_FILE = CONFIG_DIR / "config.json"
TOKEN_FILE = CONFIG_DIR / "token.json"
PROFILES_FILE = CONFIG_DIR / "profiles.json"


def config_dir() -> Path:
    return Path(os.environ.get("CHEK_APP_CLI_HOME", "~/.chek-app-cli")).expanduser()


def config_file() -> Path:
    return config_dir() / "config.json"


def token_file() -> Path:
    return config_dir() / "token.json"


def profiles_file() -> Path:
    return config_dir() / "profiles.json"


def ensure_config_dir() -> None:
    directory = config_dir()
    directory.mkdir(parents=True, exist_ok=True)
    try:
        directory.chmod(0o700)
    except OSError:
        pass


def load_json_file(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HarnessError("Invalid CHEK-APP-CLI config file.", details={"path": str(path)}) from exc


def save_json_file(path: Path, data: Any, *, private: bool = False) -> None:
    ensure_config_dir()
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if private:
        try:
            path.chmod(stat.S_IRUSR | stat.S_IWUSR)
        except OSError:
            pass


def load_config() -> dict[str, Any]:
    config = load_json_file(config_file(), {})
    if not isinstance(config, dict):
        config = {}
    env = str(config.get("env") or "dev")
    origin = str(config.get("api_origin") or ENV_ORIGINS.get(env, ENV_ORIGINS["dev"]))
    return {
        "env": env,
        "api_origin": origin.rstrip("/"),
        "client_id": str(config.get("client_id") or "app"),
        "active_profile": str(config.get("active_profile") or "default"),
        "default_as": normalize_identity(config.get("default_as") or "auto"),
        "secret_store": str(config.get("secret_store") or os.environ.get("CHEK_APP_CLI_SECRET_STORE") or "file"),
        "config_file": str(config_file()),
        "token_file": str(token_file()),
        "profiles_file": str(profiles_file()),
    }


def save_config(update: dict[str, Any]) -> dict[str, Any]:
    current = load_config()
    current.update({k: v for k, v in update.items() if v is not None})
    if current["env"] in ENV_ORIGINS and "api_origin" not in update:
        current["api_origin"] = ENV_ORIGINS[current["env"]]
    save_json_file(config_file(), {
        "env": current["env"],
        "api_origin": current["api_origin"],
        "client_id": current["client_id"],
        "active_profile": current.get("active_profile") or "default",
        "default_as": normalize_identity(current.get("default_as") or "auto"),
        "secret_store": current.get("secret_store") or "file",
    })
    return load_config()


def load_token() -> dict[str, Any]:
    token = load_json_file(token_file(), {})
    return token if isinstance(token, dict) else {}


def normalize_identity(identity: Any) -> str:
    value = str(identity or "auto").strip().lower()
    aliases = {
        "anonymous": "none",
        "anon": "none",
        "no-auth": "none",
        "none": "none",
        "bot": "service",
        "app": "service",
    }
    value = aliases.get(value, value)
    if value not in IDENTITY_CHOICES:
        raise HarnessError("Invalid identity.", details={"identity": identity, "choices": list(IDENTITY_CHOICES)})
    return value


def token_record(
    access_token: str,
    *,
    profile: dict[str, Any] | None = None,
    source: str = "manual",
    identity: str = "user",
    scopes: list[str] | None = None,
) -> dict[str, Any]:
    token = str(access_token or "").strip()
    if not token:
        raise HarnessError("Empty token cannot be saved.")
    resolved_identity = normalize_identity(identity)
    if resolved_identity in {"auto", "none"}:
        resolved_identity = "user"
    return {
        "access_token": token.removeprefix("Bearer ").strip(),
        "source": source,
        "identity": resolved_identity,
        "scopes": sorted(set(scopes or [])),
        "profile": profile or {},
    }


def save_token(
    access_token: str,
    *,
    profile: dict[str, Any] | None = None,
    source: str = "manual",
    identity: str = "user",
    scopes: list[str] | None = None,
) -> None:
    save_json_file(
        token_file(),
        token_record(access_token, profile=profile, source=source, identity=identity, scopes=scopes),
        private=True,
    )


def clear_token() -> bool:
    path = token_file()
    if path.exists():
        path.unlink()
        return True
    return False


def token_summary(token: dict[str, Any] | None = None) -> dict[str, Any]:
    token = load_token() if token is None else token
    access_token = str(token.get("access_token") or "")
    return {
        "configured": bool(access_token),
        "identity": token.get("identity") or "user",
        "tokenPreview": redact_token(access_token),
        "source": token.get("source"),
        "scopes": sorted(token.get("scopes") or []),
        "profile": token.get("profile") or {},
        "tokenFile": str(token_file()),
    }


def profile_credentials(profile: dict[str, Any]) -> dict[str, dict[str, Any]]:
    credentials = profile.get("credentials")
    if not isinstance(credentials, dict):
        credentials = {}
    normalized: dict[str, dict[str, Any]] = {}
    for identity, credential in credentials.items():
        if not isinstance(credential, dict):
            continue
        try:
            normalized[normalize_identity(identity)] = credential
        except HarnessError:
            continue
    legacy = profile.get("token")
    if isinstance(legacy, dict) and legacy.get("access_token"):
        identity = normalize_identity(legacy.get("identity") or "user")
        normalized.setdefault(identity, legacy)
    return normalized


def credential_for_identity(identity: str | None = None) -> tuple[str, dict[str, Any]]:
    requested = normalize_identity(identity or load_config().get("default_as") or "auto")
    if requested == "none":
        return "none", {}

    token = load_token()
    token_identity = normalize_identity(token.get("identity") or "user") if token.get("access_token") else "none"
    if requested == "auto" and token.get("access_token"):
        return token_identity, token
    if requested != "auto" and token.get("access_token") and token_identity == requested:
        return requested, token

    store = load_profiles()
    active_profile = store["profiles"].get(store["active"])
    credentials = profile_credentials(active_profile) if isinstance(active_profile, dict) else {}
    if requested == "auto":
        for candidate in ("user", "service"):
            credential = credentials.get(candidate)
            if credential and credential.get("access_token"):
                return candidate, credential
        return "none", {}
    credential = credentials.get(requested)
    if credential and credential.get("access_token"):
        return requested, credential
    return requested, {}


def credential_status(identity: str | None = None) -> dict[str, Any]:
    requested = normalize_identity(identity or load_config().get("default_as") or "auto")
    resolved_identity, credential = credential_for_identity(requested)
    summary = token_summary(credential)
    summary["requestedIdentity"] = requested
    summary["resolvedIdentity"] = resolved_identity
    summary["availableIdentities"] = available_identities()
    summary["secretStore"] = load_config().get("secret_store")
    return summary


def available_identities() -> list[str]:
    identities = set()
    token = load_token()
    if token.get("access_token"):
        identities.add(normalize_identity(token.get("identity") or "user"))
    store = load_profiles()
    active_profile = store["profiles"].get(store["active"])
    if isinstance(active_profile, dict):
        identities.update(profile_credentials(active_profile).keys())
    return sorted(identities)


def load_profiles() -> dict[str, Any]:
    store = load_json_file(profiles_file(), {})
    if not isinstance(store, dict):
        store = {}
    profiles = store.get("profiles")
    if not isinstance(profiles, dict):
        profiles = {}
    active = str(store.get("active") or load_config().get("active_profile") or "default")
    return {"active": active, "profiles": profiles}


def save_profiles(store: dict[str, Any]) -> dict[str, Any]:
    profiles = store.get("profiles") if isinstance(store.get("profiles"), dict) else {}
    active = str(store.get("active") or "default")
    data = {"active": active, "profiles": profiles}
    save_json_file(profiles_file(), data, private=True)
    return data


def snapshot_profile(name: str, *, include_token: bool = True) -> dict[str, Any]:
    cfg = load_config()
    profile: dict[str, Any] = {
        "name": clean_profile_name(name),
        "env": cfg["env"],
        "api_origin": cfg["api_origin"],
        "client_id": cfg["client_id"],
        "default_as": cfg.get("default_as") or "auto",
    }
    if include_token:
        token = load_token()
        if token.get("access_token"):
            identity = normalize_identity(token.get("identity") or "user")
            profile["credentials"] = {identity: token}
    return profile


def clean_profile_name(name: str) -> str:
    cleaned = str(name or "").strip()
    if not cleaned:
        raise HarnessError("Profile name cannot be empty.")
    if any(char in cleaned for char in "/\\\0"):
        raise HarnessError("Profile name cannot contain path separators.", details={"profile": name})
    return cleaned


def save_profile(name: str, *, include_token: bool = True, set_active: bool = False) -> dict[str, Any]:
    profile_name = clean_profile_name(name)
    store = load_profiles()
    store["profiles"][profile_name] = snapshot_profile(profile_name, include_token=include_token)
    if set_active:
        store["active"] = profile_name
        save_config({"active_profile": profile_name})
    return save_profiles(store)["profiles"][profile_name]


def profile_list() -> dict[str, Any]:
    store = load_profiles()
    profiles = []
    for name, profile in sorted(store["profiles"].items()):
        token = profile.get("token") if isinstance(profile, dict) else {}
        profiles.append(
            {
                "name": name,
                "active": name == store["active"],
                "env": profile.get("env") if isinstance(profile, dict) else None,
                "api_origin": profile.get("api_origin") if isinstance(profile, dict) else None,
                "client_id": profile.get("client_id") if isinstance(profile, dict) else None,
                "default_as": profile.get("default_as") if isinstance(profile, dict) else None,
                "token": token_summary(token if isinstance(token, dict) else {}),
                "credentials": {
                    identity: token_summary(credential)
                    for identity, credential in profile_credentials(profile if isinstance(profile, dict) else {}).items()
                },
            }
        )
    return {"active": store["active"], "profiles": profiles, "profilesFile": str(profiles_file())}


def use_profile(name: str, *, identity: str | None = None) -> dict[str, Any]:
    profile_name = clean_profile_name(name)
    store = load_profiles()
    profile = store["profiles"].get(profile_name)
    if not isinstance(profile, dict):
        raise HarnessError("Profile not found.", details={"profile": profile_name, "available": sorted(store["profiles"])})
    env = str(profile.get("env") or "dev")
    selected_identity = normalize_identity(identity or profile.get("default_as") or "auto")
    save_config(
        {
            "env": env,
            "api_origin": profile.get("api_origin") or ENV_ORIGINS.get(env, ENV_ORIGINS["dev"]),
            "client_id": profile.get("client_id") or "app",
            "active_profile": profile_name,
            "default_as": selected_identity,
        }
    )
    credentials = profile_credentials(profile)
    resolved_identity = selected_identity
    token: dict[str, Any] = {}
    if selected_identity == "auto":
        for candidate in ("user", "service"):
            if credentials.get(candidate, {}).get("access_token"):
                resolved_identity = candidate
                token = credentials[candidate]
                break
    else:
        token = credentials.get(selected_identity) or {}
    if token.get("access_token"):
        save_json_file(token_file(), token, private=True)
    else:
        clear_token()
    store["active"] = profile_name
    save_profiles(store)
    return {"active": profile_name, "config": load_config(), "token": token_summary(), "resolvedIdentity": resolved_identity}


def delete_profile(name: str) -> dict[str, Any]:
    profile_name = clean_profile_name(name)
    store = load_profiles()
    removed = store["profiles"].pop(profile_name, None)
    if removed is None:
        raise HarnessError("Profile not found.", details={"profile": profile_name, "available": sorted(store["profiles"])})
    if store["active"] == profile_name:
        store["active"] = "default"
        save_config({"active_profile": "default"})
    save_profiles(store)
    return {"removed": profile_name, "active": store["active"], "remaining": sorted(store["profiles"])}


def export_profile(name: str, *, include_token: bool = False) -> dict[str, Any]:
    profile_name = clean_profile_name(name)
    store = load_profiles()
    profile = store["profiles"].get(profile_name)
    if not isinstance(profile, dict):
        raise HarnessError("Profile not found.", details={"profile": profile_name, "available": sorted(store["profiles"])})
    exported = dict(profile)
    exported["name"] = profile_name
    if not include_token:
        token = exported.pop("token", None)
        if isinstance(token, dict):
            exported["tokenPreview"] = token_summary(token)
        credentials = exported.pop("credentials", None)
        if isinstance(credentials, dict):
            exported["credentialPreview"] = {
                identity: token_summary(credential)
                for identity, credential in profile_credentials({"credentials": credentials}).items()
            }
    return exported


def import_profile(name: str, profile: dict[str, Any], *, set_active: bool = False) -> dict[str, Any]:
    if not isinstance(profile, dict):
        raise HarnessError("Imported profile must be a JSON object.")
    profile_name = clean_profile_name(name)
    stored = {
        "name": profile_name,
        "env": str(profile.get("env") or "dev"),
        "api_origin": str(profile.get("api_origin") or ENV_ORIGINS.get(str(profile.get("env") or "dev"), ENV_ORIGINS["dev"])).rstrip("/"),
        "client_id": str(profile.get("client_id") or "app"),
        "default_as": normalize_identity(profile.get("default_as") or "auto"),
    }
    token = profile.get("token")
    if isinstance(token, dict) and token.get("access_token"):
        token["identity"] = normalize_identity(token.get("identity") or "user")
        stored.setdefault("credentials", {})[token["identity"]] = token
    credentials = profile.get("credentials")
    if isinstance(credentials, dict):
        stored["credentials"] = {
            normalize_identity(identity): credential
            for identity, credential in credentials.items()
            if isinstance(credential, dict) and credential.get("access_token")
        }
    store = load_profiles()
    store["profiles"][profile_name] = stored
    if set_active:
        store["active"] = profile_name
    save_profiles(store)
    if set_active:
        return use_profile(profile_name)
    return stored


def save_profile_credential(
    profile_name: str,
    access_token: str,
    *,
    identity: str = "user",
    source: str = "manual",
    scopes: list[str] | None = None,
    activate: bool = False,
) -> dict[str, Any]:
    name = clean_profile_name(profile_name)
    resolved_identity = normalize_identity(identity)
    if resolved_identity in {"auto", "none"}:
        raise HarnessError("Credential identity must be user or service.", details={"identity": identity})
    store = load_profiles()
    profile = store["profiles"].get(name)
    if not isinstance(profile, dict):
        cfg = load_config()
        profile = {
            "name": name,
            "env": cfg["env"],
            "api_origin": cfg["api_origin"],
            "client_id": cfg["client_id"],
            "default_as": resolved_identity,
            "credentials": {},
        }
    credentials = profile_credentials(profile)
    credentials[resolved_identity] = token_record(access_token, source=source, identity=resolved_identity, scopes=scopes)
    profile["credentials"] = credentials
    profile["default_as"] = resolved_identity if profile.get("default_as") in (None, "auto") else profile.get("default_as")
    store["profiles"][name] = profile
    if activate:
        store["active"] = name
        save_profiles(store)
        return use_profile(name, identity=resolved_identity)
    save_profiles(store)
    return {
        "profile": name,
        "identity": resolved_identity,
        "credential": token_summary(credentials[resolved_identity]),
    }


def check_scopes(required_scopes: list[str], *, identity: str | None = None) -> dict[str, Any]:
    resolved_identity, credential = credential_for_identity(identity)
    configured_scopes = set(credential.get("scopes") or [])
    required = sorted(set(scope for scope in required_scopes if scope))
    missing = [scope for scope in required if scope not in configured_scopes]
    unknown = bool(required and not configured_scopes)
    return {
        "identity": resolved_identity,
        "required": required,
        "configured": sorted(configured_scopes),
        "missing": missing,
        "ok": bool(required) and not missing if not unknown else False,
        "unknown": unknown,
        "hint": "CHEK tokens do not currently expose OAuth-style scopes unless provided when storing the credential.",
    }


def redact_token(token: str) -> str:
    token = str(token or "")
    if not token:
        return ""
    if len(token) <= 12:
        return "***"
    return f"{token[:6]}...{token[-4:]}"


def parse_json_arg(raw: str | None, *, stdin=None, flag_name: str = "--data") -> Any:
    if raw is None or raw == "":
        return None
    if raw == "-":
        if stdin is None:
            raise HarnessError(f"{flag_name}=- requires stdin.")
        raw = stdin.read()
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HarnessError(f"{flag_name} must be valid JSON.", details={"value": raw}) from exc


def normalize_path(path: str) -> str:
    raw = str(path or "").strip()
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw
    return "/" + raw.lstrip("/")


def build_url(path: str, params: dict[str, Any] | None = None, *, config: dict[str, Any] | None = None) -> str:
    normalized = normalize_path(path)
    if normalized.startswith("http://") or normalized.startswith("https://"):
        base = normalized
    else:
        cfg = config or load_config()
        base = f"{cfg['api_origin']}{normalized}"
    if params:
        filtered: dict[str, Any] = {}
        for key, value in params.items():
            if value is None or value == "":
                continue
            if isinstance(value, list):
                filtered[key] = ",".join(str(item) for item in value)
            else:
                filtered[key] = value
        query = urllib.parse.urlencode(filtered)
        if query:
            joiner = "&" if "?" in base else "?"
            base = f"{base}{joiner}{query}"
    return base


def request_api(
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    data: Any = None,
    auth: bool = True,
    identity: str | None = None,
    timeout: int = 30,
    dry_run: bool = False,
) -> dict[str, Any]:
    cfg = load_config()
    url = build_url(path, params, config=cfg)
    method = method.upper()
    resolved_identity, token = credential_for_identity(identity)
    headers = {
        "Accept": "application/json",
        "User-Agent": "CHEK-APP-CLI/0.1",
    }
    body = None
    if data is not None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if auth and token.get("access_token") and resolved_identity != "none":
        raw_token = str(token["access_token"]).strip().removeprefix("Bearer ").strip()
        headers["Authorization"] = f"Bearer {raw_token}"
        headers["token"] = raw_token

    dry = {
        "method": method,
        "url": url,
        "headers": redact_headers(headers),
        "body": data,
        "auth": auth,
        "identity": resolved_identity if auth else "none",
    }
    if dry_run:
        return {"ok": True, "dryRun": True, "request": dry}

    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw_body = resp.read()
            parsed = parse_response_body(raw_body, resp.headers.get("Content-Type", ""))
            return normalize_api_result(resp.status, parsed, raw_body, dry)
    except urllib.error.HTTPError as exc:
        raw_body = exc.read()
        parsed = parse_response_body(raw_body, exc.headers.get("Content-Type", ""))
        result = normalize_api_result(exc.code, parsed, raw_body, dry)
        result["ok"] = False
        return result
    except urllib.error.URLError as exc:
        return {
            "ok": False,
            "status": None,
            "error": {"type": "network", "message": str(exc)},
            "request": dry,
        }


def redact_headers(headers: dict[str, str]) -> dict[str, str]:
    redacted = dict(headers)
    for key in list(redacted.keys()):
        if key.lower() in {"authorization", "token"}:
            redacted[key] = redact_token(redacted[key])
    return redacted


def parse_response_body(raw: bytes, content_type: str) -> Any:
    text = raw.decode("utf-8", errors="replace")
    if "json" in content_type.lower() or text.startswith("{") or text.startswith("["):
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return text
    return text


def normalize_api_result(status: int, parsed: Any, raw_body: bytes, request: dict[str, Any]) -> dict[str, Any]:
    ok = 200 <= int(status) < 300
    error = None
    data = parsed
    if isinstance(parsed, dict):
        if parsed.get("success") is True:
            data = parsed.get("data")
        elif parsed.get("code") in (0, 200, "0", "200", "SUCCESS"):
            data = parsed.get("data")
        elif "success" in parsed and parsed.get("success") is False:
            ok = False
            error = {
                "type": "api",
                "code": parsed.get("code"),
                "message": parsed.get("message") or parsed.get("msg") or "API returned success=false",
                "detail": parsed,
            }
        elif "code" in parsed and parsed.get("code") not in (0, 200, "0", "200", "SUCCESS"):
            ok = False
            error = {
                "type": "api",
                "code": parsed.get("code"),
                "message": parsed.get("message") or parsed.get("msg") or "API returned non-success code",
                "detail": parsed,
            }
    if status >= 400:
        ok = False
        error = error or {"type": "http", "code": status, "message": f"HTTP {status}", "detail": parsed}

    result = {
        "ok": ok,
        "status": status,
        "data": data,
        "request": request,
    }
    if error:
        result["error"] = error
    if not isinstance(parsed, (dict, list)):
        result["rawText"] = parsed
        result["sizeBytes"] = len(raw_body)
    return result


def login_with_password(phone: str, password: str) -> dict[str, Any]:
    cfg = load_config()
    result = request_api(
        "POST",
        "/api/auth/v1/accounts/passwordLogin",
        data={"mobilePhone": phone, "password": password, "clientId": cfg["client_id"]},
        auth=False,
    )
    if result.get("ok"):
        token = extract_token(result.get("data"))
        if token:
            save_token(token, profile=extract_profile(result.get("data")), source="password")
    return result


def sms_send(phone: str, scene: str = "login") -> dict[str, Any]:
    return request_api(
        "POST",
        "/api/auth/v1/sms/send",
        data={"mobilePhone": phone, "scene": scene},
        auth=False,
    )


def sms_login(phone: str, code: str) -> dict[str, Any]:
    cfg = load_config()
    result = request_api(
        "POST",
        "/api/auth/v1/accounts/smsLogin",
        data={"mobilePhone": phone, "code": str(code), "clientId": cfg["client_id"]},
        auth=False,
    )
    if result.get("ok"):
        token = extract_token(result.get("data"))
        if token:
            save_token(token, profile=extract_profile(result.get("data")), source="sms")
    return result


def extract_token(data: Any) -> str:
    if not isinstance(data, dict):
        return ""
    return str(data.get("accessToken") or data.get("AccessToken") or data.get("token") or "").strip()


def extract_profile(data: Any) -> dict[str, Any]:
    if not isinstance(data, dict):
        return {}
    return {
        key: data.get(key)
        for key in ("userOneId", "mobilePhone", "nickName", "avatarUrl")
        if data.get(key) is not None
    }
