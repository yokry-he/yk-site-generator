import type { ArtifactFile, ManualAccessDefinition, ManualEntityDefinition } from 'shared'
import { text } from './manualCrudHelpers'
import { replaceFile, runtimeRules, runtimeTargets } from './manualAuthCommon'

export function fastApiAuth(
  files: ArtifactFile[],
  access: ManualAccessDefinition,
  entities: readonly ManualEntityDefinition[],
): ArtifactFile[] {
  const rules = JSON.stringify(runtimeRules(access))
  const targets = JSON.stringify(runtimeTargets(entities))
  replaceFile(files, 'apps/api/app/main.py', (content) => content
    .replace('from fastapi import FastAPI', 'from fastapi import FastAPI, Request')
    .replace('from .routes import router', 'from .auth import AuthMiddleware, auth_status\nfrom .routes import router')
    .replace(
      'app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])',
      'app.add_middleware(AuthMiddleware)\napp.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])',
    )
    .replace(
      'app.get("/api/health")(lambda: {"status": "ok", "stack": "FastAPI + SQLAlchemy"})',
      'app.get("/api/health")(lambda: {"status": "ok", "stack": "FastAPI + SQLAlchemy"})\n\n@app.get("/api/auth/me")\ndef auth_me(request: Request):\n    return auth_status(request)',
    ))

  return [text('apps/api/app/auth.py', `from __future__ import annotations

import hashlib
import hmac
import json
import os
from typing import Any

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

RULES: dict[str, dict[str, list[str]]] = ${rules}
TARGETS: list[dict[str, str]] = ${targets}
_cached_raw = ""
_cached_identities: list[dict[str, str]] = []


def auth_enabled() -> bool:
    return os.getenv("AUTH_ENABLED", "").lower() in {"1", "true", "yes", "on"}


def identities() -> list[dict[str, str]]:
    global _cached_raw, _cached_identities
    raw = os.getenv("AUTH_IDENTITIES_JSON", "")
    if raw == _cached_raw:
        return _cached_identities
    _cached_raw = raw
    try:
        value = json.loads(raw)
        _cached_identities = [
            item for item in value
            if isinstance(item, dict)
            and isinstance(item.get("token"), str) and len(item["token"]) >= 16
            and isinstance(item.get("userId"), str)
            and isinstance(item.get("email"), str)
            and isinstance(item.get("role"), str) and item["role"] in RULES
        ] if isinstance(value, list) else []
    except (TypeError, ValueError):
        _cached_identities = []
    return _cached_identities


def authenticate(header: str | None) -> dict[str, str] | None:
    token = header[7:].strip() if header and header.startswith("Bearer ") else ""
    if not token:
        return None
    return next((item for item in identities() if hmac.compare_digest(
        hashlib.sha256(item["token"].encode()).digest(),
        hashlib.sha256(token.encode()).digest(),
    )), None)


def resolve_action(method: str, path: str) -> tuple[str, str] | None:
    target = next((item for item in TARGETS if path == item["route"] or path.startswith(item["route"] + "/")), None)
    if not target:
        return None
    detail = path != target["route"]
    if method == "GET":
        return target["entity"], "read" if detail else "list"
    if method == "POST" and not detail:
        return target["entity"], "create"
    if method in {"PATCH", "PUT"} and detail:
        return target["entity"], "update"
    if method == "DELETE" and detail:
        return target["entity"], "delete"
    return None


def public_identity(identity: dict[str, str]) -> dict[str, str]:
    return {key: identity[key] for key in ("userId", "email", "role")}


def auth_status(request: Request) -> dict[str, Any]:
    return {
        "enabled": auth_enabled(),
        "identity": getattr(request.state, "identity", None),
    }


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if request.method == "OPTIONS" or path == "/api/health" or not auth_enabled():
            return await call_next(request)
        configured = identities()
        if not configured:
            return JSONResponse({"error": "AUTH_NOT_CONFIGURED"}, status_code=503)
        identity = authenticate(request.headers.get("authorization"))
        if identity is None:
            return JSONResponse({"error": "UNAUTHORIZED"}, status_code=401)
        request.state.identity = public_identity(identity)
        if path != "/api/auth/me":
            resolved = resolve_action(request.method, path)
            if resolved is not None:
                entity, action = resolved
                if action not in RULES.get(identity["role"], {}).get(entity, []):
                    return JSONResponse({"error": "FORBIDDEN"}, status_code=403)
        return await call_next(request)
`)]
}
