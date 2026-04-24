#!/usr/bin/env python3
"""Check whether the bundled OpenAPI registry is stale."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "cli_anything" / "frontend_app" / "generated" / "registry.json"
GENERATOR = ROOT / "scripts" / "generate_openapi_registry.py"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--allow-missing-optional", action="store_true", help="Skip drift comparison when optional sources are unavailable.")
    parser.add_argument("--source", action="append", default=[], metavar="SERVICE=PATH_OR_URL", help="Extra source override for the generator.")
    args = parser.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        generated_path = Path(tmp) / "registry.json"
        sources = default_sources_from_env() + args.source
        command = [sys.executable, str(GENERATOR), "--output", str(generated_path), *source_args(sources)]
        subprocess.run(command, cwd=ROOT, check=True)
        current = load_json(REGISTRY)
        generated = load_json(generated_path)

    failed = generated.get("_meta", {}).get("failedSources") or []
    if failed and args.allow_missing_optional and all(item.get("optional") for item in failed if isinstance(item, dict)):
        print(
            json.dumps(
                {
                    "ok": True,
                    "skipped": True,
                    "reason": "optional OpenAPI sources unavailable",
                    "failedSources": failed,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    if failed:
        print(json.dumps({"ok": False, "failedSources": failed}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1

    normalized_current = normalize_registry(current)
    normalized_generated = normalize_registry(generated)
    if normalized_current != normalized_generated:
        print(
            json.dumps(
                {
                    "ok": False,
                    "message": "Bundled registry is stale. Run scripts/generate_openapi_registry.py and commit the result.",
                    "currentOperations": current.get("_meta", {}).get("operationCount"),
                    "generatedOperations": generated.get("_meta", {}).get("operationCount"),
                },
                ensure_ascii=False,
                indent=2,
            ),
            file=sys.stderr,
        )
        return 1

    print(
        json.dumps(
            {
                "ok": True,
                "operationCount": current.get("_meta", {}).get("operationCount"),
                "serviceCount": current.get("_meta", {}).get("serviceCount"),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


def source_args(raw_sources: list[str]) -> list[str]:
    args: list[str] = []
    for source in raw_sources:
        args.extend(["--source", source])
    return args


def default_sources_from_env() -> list[str]:
    backend_saas = os.environ.get("CHEK_BACKEND_SAAS_OPENAPI")
    if backend_saas:
        return [f"backend-saas={backend_saas}"]
    return []


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_registry(registry: dict[str, Any]) -> dict[str, Any]:
    normalized = json.loads(json.dumps(registry, ensure_ascii=False, sort_keys=True))
    meta = normalized.get("_meta")
    if isinstance(meta, dict):
        meta.pop("generatedAt", None)
        sources = meta.get("sources")
        if isinstance(sources, dict):
            for source in sources.values():
                if isinstance(source, dict):
                    source.pop("location", None)
    return normalized


if __name__ == "__main__":
    sys.exit(main())
