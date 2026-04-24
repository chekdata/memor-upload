#!/usr/bin/env python3
"""Generate CHEK-APP-CLI registry from backend OpenAPI specs."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any


HTTP_METHODS = {"get", "post", "put", "patch", "delete", "head", "options"}
VERSION_SEGMENT = re.compile(r"^v\d+(\.\d+)?$", re.I)

DEFAULT_SOURCES = [
    {
        "service": "auth",
        "title": "backend-auth-saas",
        "servicePath": "/api/auth",
        "url": "https://api-dev.chekkk.com/api/auth/openapi.json",
    },
    {
        "service": "backend-app",
        "title": "backend-app",
        "servicePath": "/api/backend-app",
        "url": "https://api-dev.chekkk.com/api/backend-app/openapi.json",
    },
    {
        "service": "vehicle",
        "title": "vehicle-model-service",
        "servicePath": "/api/vms",
        "url": "https://api-dev.chekkk.com/api/vms/openapi.json",
    },
    {
        "service": "crowd",
        "title": "backend-crowd-data-saas",
        "servicePath": "/api/crowd-control",
        "url": "https://api-dev.chekkk.com/api/crowd-control/openapi.json",
    },
    {
        "service": "humanoid",
        "title": "backend-humanoid-chain",
        "servicePath": "/api/humanoid-chain",
        "url": "https://api-dev.chekkk.com/api/humanoid-chain/openapi.json",
    },
    {
        "service": "backend-saas",
        "title": "backend-saas",
        "servicePath": "/api/backend-saas",
        "url": "https://api-dev.chekkk.com/api/backend-saas/openapi.json",
        "optional": True,
    },
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("cli_anything/frontend_app/generated/registry.json"),
        help="Registry JSON output path.",
    )
    parser.add_argument(
        "--source",
        action="append",
        default=[],
        metavar="SERVICE=PATH_OR_URL",
        help="Override/add an OpenAPI source. Example: backend-saas=/path/to/openapi.json",
    )
    parser.add_argument("--strict", action="store_true", help="Fail when any source cannot be loaded.")
    args = parser.parse_args()

    sources = merge_sources(DEFAULT_SOURCES, args.source)
    generated = generate_registry(sources, strict=args.strict)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(generated, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    meta = generated["_meta"]
    print(
        json.dumps(
            {
                "output": str(args.output),
                "serviceCount": len(generated["services"]),
                "operationCount": meta["operationCount"],
                "failedSources": meta["failedSources"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    if args.strict and meta["failedSources"]:
        return 1
    return 0


def merge_sources(defaults: list[dict[str, Any]], overrides: list[str]) -> list[dict[str, Any]]:
    sources = {item["service"]: dict(item) for item in defaults}
    for raw in overrides:
        if "=" not in raw:
            raise SystemExit(f"--source must use SERVICE=PATH_OR_URL: {raw}")
        service, location = raw.split("=", 1)
        service = service.strip()
        if not service:
            raise SystemExit(f"--source service cannot be empty: {raw}")
        current = sources.get(service, {"service": service, "title": service, "servicePath": f"/api/{service}"})
        current.pop("url", None)
        current.pop("path", None)
        if location.startswith(("http://", "https://")):
            current["url"] = location
        else:
            current["path"] = location
        current["optional"] = False
        sources[service] = current
    return list(sources.values())


def generate_registry(sources: list[dict[str, Any]], *, strict: bool = False) -> dict[str, Any]:
    services: dict[str, Any] = {}
    meta_sources: dict[str, Any] = {}
    failed_sources: list[dict[str, Any]] = []

    for source in sources:
        service = source["service"]
        try:
            spec = load_spec(source)
        except Exception as exc:
            failure = {
                "service": service,
                "location": display_location(source),
                "error": str(exc),
                "optional": bool(source.get("optional")),
            }
            failed_sources.append(failure)
            meta_sources[service] = {
                "ok": False,
                **failure,
                "rawOperations": 0,
                "registeredOperations": 0,
                "deduplicatedOperations": 0,
            }
            if strict and not source.get("optional"):
                raise
            continue

        service_spec, stats = build_service_registry(source, spec)
        services[service] = service_spec
        meta_sources[service] = {
            "ok": True,
            "location": display_location(source),
            "openapi": spec.get("openapi") or spec.get("swagger"),
            "title": (spec.get("info") or {}).get("title"),
            **stats,
        }

    operation_count = sum(item["registeredOperations"] for item in meta_sources.values())
    return {
        "_meta": {
            "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "generator": "scripts/generate_openapi_registry.py",
            "operationCount": operation_count,
            "serviceCount": len(services),
            "sources": meta_sources,
            "failedSources": failed_sources,
        },
        "services": dict(sorted(services.items())),
    }


def load_spec(source: dict[str, Any]) -> dict[str, Any]:
    if source.get("path"):
        text = Path(source["path"]).expanduser().read_text(encoding="utf-8")
    else:
        text = fetch_url_with_retries(source["url"])
    data = json.loads(text)
    if not isinstance(data, dict) or not isinstance(data.get("paths"), dict):
        raise ValueError("document is not an OpenAPI object with paths")
    return data


def display_location(source: dict[str, Any]) -> str:
    if source.get("url"):
        return str(source["url"])
    if source.get("path"):
        return "file:" + Path(source["path"]).expanduser().name
    return ""


def fetch_url_with_retries(url: str, attempts: int = 3) -> str:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        req = urllib.request.Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": "CHEK-APP-CLI-OpenAPI-Generator/0.1",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                return resp.read().decode("utf-8")
        except Exception as exc:
            last_error = exc
            if attempt < attempts:
                time.sleep(1.5 * attempt)
    raise last_error or RuntimeError(f"failed to fetch {url}")


def build_service_registry(source: dict[str, Any], spec: dict[str, Any]) -> tuple[dict[str, Any], dict[str, int]]:
    service_path = normalize_service_path(source["servicePath"])
    resources: dict[str, Any] = {}
    seen: set[tuple[str, str]] = set()
    raw_operations = 0
    deduplicated = 0

    for raw_path, path_item in sorted((spec.get("paths") or {}).items()):
        if not isinstance(path_item, dict):
            continue
        for method, operation in sorted(path_item.items()):
            method_l = method.lower()
            if method_l not in HTTP_METHODS or not isinstance(operation, dict):
                continue
            raw_operations += 1
            path = canonical_gateway_path(service_path, raw_path)
            dedupe_key = (method_l, path)
            if dedupe_key in seen:
                deduplicated += 1
                continue
            seen.add(dedupe_key)

            resource_key, method_key = derive_resource_method(service_path, path, method_l)
            resource = resources.setdefault(resource_key, {"methods": {}})
            methods = resource["methods"]
            method_key = unique_method_key(methods, method_key, method_l)
            methods[method_key] = operation_schema(
                service=source["service"],
                service_path=service_path,
                raw_path=raw_path,
                path=path,
                method=method_l,
                operation=operation,
            )

    return (
        {
            "title": source.get("title") or (spec.get("info") or {}).get("title") or source["service"],
            "servicePath": service_path,
            "openapi": spec.get("openapi") or spec.get("swagger"),
            "description": (spec.get("info") or {}).get("description"),
            "components": compact_components(spec.get("components")),
            "resources": dict(sorted(resources.items())),
        },
        {
            "rawOperations": raw_operations,
            "registeredOperations": sum(len((res.get("methods") or {})) for res in resources.values()),
            "deduplicatedOperations": deduplicated,
        },
    )


def operation_schema(
    *,
    service: str,
    service_path: str,
    raw_path: str,
    path: str,
    method: str,
    operation: dict[str, Any],
) -> dict[str, Any]:
    parameters = []
    for param in operation.get("parameters") or []:
        if not isinstance(param, dict):
            continue
        parameters.append(
            {
                "name": param.get("name"),
                "location": param.get("in"),
                "required": bool(param.get("required")),
                "description": param.get("description"),
                "schema": compact_schema(param.get("schema")),
            }
        )

    return {
        "httpMethod": method.upper(),
        "path": path,
        "description": operation.get("summary") or operation.get("description") or "",
        "summary": operation.get("summary"),
        "operationId": operation.get("operationId"),
        "tags": operation.get("tags") or [],
        "parameters": parameters,
        "pathParameters": [item["name"] for item in parameters if item.get("location") == "path"],
        "queryParameters": [item["name"] for item in parameters if item.get("location") == "query"],
        "requestBody": compact_request_body(operation.get("requestBody")),
        "responses": compact_responses(operation.get("responses")),
        "security": operation.get("security"),
        "source": {
            "service": service,
            "servicePath": service_path,
            "rawPath": raw_path,
        },
    }


def compact_request_body(body: Any) -> Any:
    if not isinstance(body, dict):
        return None
    content = body.get("content") or {}
    return {
        "required": bool(body.get("required")),
        "contentTypes": sorted(content.keys()),
        "schema": {
            content_type: compact_schema((payload or {}).get("schema"))
            for content_type, payload in sorted(content.items())
            if isinstance(payload, dict)
        },
    }


def compact_responses(responses: Any) -> dict[str, Any]:
    if not isinstance(responses, dict):
        return {}
    compact: dict[str, Any] = {}
    for code, response in sorted(responses.items()):
        if not isinstance(response, dict):
            continue
        content = response.get("content") or {}
        compact[str(code)] = {
            "description": response.get("description"),
            "contentTypes": sorted(content.keys()),
            "schema": {
                content_type: compact_schema((payload or {}).get("schema"))
                for content_type, payload in sorted(content.items())
                if isinstance(payload, dict)
            },
        }
    return compact


def compact_components(components: Any) -> dict[str, Any]:
    if not isinstance(components, dict):
        return {}
    schemas = components.get("schemas")
    if not isinstance(schemas, dict):
        return {}
    return {"schemas": {name: compact_schema(schema) for name, schema in sorted(schemas.items()) if isinstance(schema, dict)}}


def compact_schema(schema: Any) -> Any:
    if not isinstance(schema, dict):
        return schema
    if "$ref" in schema:
        return {"$ref": schema["$ref"]}
    keep = {}
    for key in ("type", "format", "items", "properties", "required", "enum", "description", "default", "nullable", "anyOf", "oneOf", "allOf"):
        if key in schema:
            value = schema[key]
            if key == "items":
                value = compact_schema(value)
            elif key == "properties" and isinstance(value, dict):
                value = {k: compact_schema(v) for k, v in sorted(value.items())}
            elif key in {"anyOf", "oneOf", "allOf"} and isinstance(value, list):
                value = [compact_schema(item) for item in value]
            keep[key] = value
    return keep


def normalize_service_path(path: str) -> str:
    return "/" + str(path or "").strip().strip("/")


def canonical_gateway_path(service_path: str, raw_path: str) -> str:
    raw = "/" + str(raw_path or "").strip().lstrip("/")
    if raw == service_path or raw.startswith(service_path + "/"):
        return raw
    return collapse_slashes(service_path + raw)


def collapse_slashes(path: str) -> str:
    return re.sub(r"/+", "/", path)


def derive_resource_method(service_path: str, path: str, method: str) -> tuple[str, str]:
    relative = path
    if relative == service_path:
        relative = "/"
    elif relative.startswith(service_path + "/"):
        relative = relative[len(service_path) :]
    segments = [segment for segment in relative.strip("/").split("/") if segment]
    segments = trim_leading_noise(segments)
    if not segments:
        return "root", http_action(method, has_path_id=False)

    first = segments[0]
    if ":" in first:
        resource_part, action_part = first.split(":", 1)
        resource = normalize_identifier(resource_part) or "root"
        rest = [action_part, *segments[1:]]
    else:
        resource = normalize_identifier(first) or "root"
        rest = segments[1:]
    rest = trim_method_segments(rest)
    method_key = method_from_segments(rest, method)
    return resource, method_key


def trim_leading_noise(segments: list[str]) -> list[str]:
    trimmed = list(segments)
    while trimmed and (trimmed[0].lower() == "api" or VERSION_SEGMENT.match(trimmed[0])):
        trimmed.pop(0)
    return trimmed


def trim_method_segments(segments: list[str]) -> list[str]:
    return [segment for segment in segments if not VERSION_SEGMENT.match(segment)]


def method_from_segments(segments: list[str], method: str) -> str:
    if not segments:
        return http_action(method, has_path_id=False)

    parts: list[str] = []
    has_path_id = False
    for segment in segments:
        if is_path_param(segment):
            has_path_id = True
            continue
        if ":" in segment:
            base, action = segment.split(":", 1)
            if not parts or normalize_identifier(base) != normalize_identifier(parts[-1]):
                parts.append(base)
            parts.append(action)
            continue
        parts.append(segment)

    if not parts:
        return http_action(method, has_path_id=has_path_id)
    action = normalize_identifier("_".join(parts))
    if not action:
        action = http_action(method, has_path_id=has_path_id)
    if method in {"put", "patch", "delete", "head"}:
        action = action + http_action(method, has_path_id=has_path_id).title()
    return action


def http_action(method: str, *, has_path_id: bool) -> str:
    if method == "get":
        return "detail" if has_path_id else "list"
    if method == "post":
        return "create"
    if method in {"put", "patch"}:
        return "update"
    if method == "delete":
        return "delete"
    return method


def is_path_param(segment: str) -> bool:
    return segment.startswith("{") and segment.endswith("}")


def normalize_identifier(value: str) -> str:
    raw = re.sub(r"[{}]", "", str(value or ""))
    raw = re.sub(r"[^0-9A-Za-z]+", "_", raw).strip("_")
    if not raw:
        return ""
    parts = [part for part in raw.split("_") if part]
    first = parts[0][:1].lower() + parts[0][1:]
    rest = [part[:1].upper() + part[1:] for part in parts[1:]]
    return first + "".join(rest)


def unique_method_key(methods: dict[str, Any], key: str, method: str) -> str:
    if key not in methods:
        return key
    suffixed = key + method.title()
    if suffixed not in methods:
        return suffixed
    index = 2
    while f"{suffixed}{index}" in methods:
        index += 1
    return f"{suffixed}{index}"


if __name__ == "__main__":
    sys.exit(main())
