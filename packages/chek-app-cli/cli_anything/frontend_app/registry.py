"""OpenAPI-backed registry for CHEK-APP-CLI."""

from __future__ import annotations

import json
from importlib import resources
from typing import Any, Iterator


def _load_bundle() -> dict[str, Any]:
    try:
        path = resources.files("cli_anything.frontend_app.generated").joinpath("registry.json")
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"_meta": {"operationCount": 0, "sources": {}, "failedSources": []}, "services": {}}


_BUNDLE = _load_bundle()
REGISTRY_META: dict[str, Any] = _BUNDLE.get("_meta") or {}
REGISTRY: dict[str, dict[str, Any]] = _BUNDLE.get("services") or {}


def list_services() -> list[dict[str, Any]]:
    return [
        {
            "service": name,
            "title": spec.get("title"),
            "servicePath": spec.get("servicePath"),
            "openapi": spec.get("openapi"),
            "resources": sorted((spec.get("resources") or {}).keys()),
            "methodCount": sum(len((resource.get("methods") or {})) for resource in (spec.get("resources") or {}).values()),
        }
        for name, spec in sorted(REGISTRY.items())
    ]


def get_schema(path: str | None = None) -> dict[str, Any] | list[dict[str, Any]]:
    if not path:
        return list_services()
    parts = path.split(".")
    if len(parts) == 1:
        return REGISTRY.get(parts[0], {})
    if len(parts) == 2:
        return ((REGISTRY.get(parts[0]) or {}).get("resources") or {}).get(parts[1], {})
    if len(parts) == 3:
        resources = ((REGISTRY.get(parts[0]) or {}).get("resources") or {})
        methods = (resources.get(parts[1]) or {}).get("methods") or {}
        return methods.get(parts[2], {})
    return {}


def find_method(service: str, resource: str, method: str) -> dict[str, Any]:
    schema = get_schema(f"{service}.{resource}.{method}")
    return schema if isinstance(schema, dict) else {}


def resolve_schema_ref(service: str, ref: str) -> dict[str, Any]:
    prefix = "#/components/schemas/"
    if not str(ref).startswith(prefix):
        return {}
    name = str(ref)[len(prefix) :]
    schemas = ((REGISTRY.get(service) or {}).get("components") or {}).get("schemas") or {}
    schema = schemas.get(name)
    return schema if isinstance(schema, dict) else {}


def iter_methods() -> Iterator[tuple[str, str, str, dict[str, Any]]]:
    for service_name, service in sorted(REGISTRY.items()):
        resources = service.get("resources") or {}
        for resource_name, resource in sorted(resources.items()):
            methods = resource.get("methods") or {}
            for method_name, method in sorted(methods.items()):
                yield service_name, resource_name, method_name, method
