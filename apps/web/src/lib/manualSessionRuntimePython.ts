import type { ArtifactFile, ManualAccessDefinition, ManualEntityDefinition } from 'shared'
import { replaceFile, runtimeRules, runtimeTargets } from './manualAuthCommon'
import { text } from './manualCrudHelpers'
import { sessionBootstrapRole } from './manualSessionRuntimeCommon'

export function fastApiSessionRuntime(
  files: ArtifactFile[],
  access: ManualAccessDefinition,
  entities: readonly ManualEntityDefinition[],
): ArtifactFile[] {
  const rules = JSON.stringify(runtimeRules(access))
  const targets = JSON.stringify(runtimeTargets(entities))
  const role = JSON.stringify(sessionBootstrapRole(access, entities))

  replaceFile(files, 'apps/api/app/main.py', (content) => {
    let next = content
      .replace('from .auth import AuthMiddleware, auth_status', 'from .auth import AuthMiddleware')
      .replace('from .routes import router', 'from .routes import router\nfrom .session_auth import router as session_auth_router')
      .replace(/\n@app\.get\("\/api\/auth\/me"\)\ndef auth_me\(request: Request\):\n    return auth_status\(request\)\n?/, '\n')
    if (!next.includes('app.include_router(session_auth_router)')) {
      next = next.replace('app.include_router(router)', 'app.include_router(router)\napp.include_router(session_auth_router)')
    }
    return next
  })

  replaceFile(files, 'apps/api/app/auth.py', () => `from __future__ import annotations

import hashlib
import hmac
import json
import os
from typing import Any

from fastapi import Request
from sqlalchemy import func, select
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from . import models
from .database import SessionLocal

RULES: dict[str, dict[str, list[str]]] = ${rules}
TARGETS: list[dict[str, str]] = ${targets}
PUBLIC_PATHS = {"/api/health", "/api/auth/bootstrap", "/api/auth/login"}
_cached_raw = ""
_cached_identities: list[dict[str, str]] = []


def auth_enabled() -> bool:
    return os.getenv("AUTH_ENABLED", "").lower() in {"1", "true", "yes", "on"}


def static_identities() -> list[dict[str, str]]:
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


def token_from_header(header: str | None) -> str:
    return header[7:].strip() if header and header.startswith("Bearer ") else ""


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def authenticate_static(token: str) -> dict[str, Any] | None:
    candidate = hashlib.sha256(token.encode()).digest()
    identity = next((item for item in static_identities() if hmac.compare_digest(
        hashlib.sha256(item["token"].encode()).digest(), candidate,
    )), None)
    if identity is None:
        return None
    return {"userId": identity["userId"], "email": identity["email"], "role": identity["role"], "source": "static"}


def authenticate_session(token: str) -> dict[str, Any] | None:
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        statement = (
            select(models.AuthSession, models.AuthUser)
            .join(models.AuthUser, models.AuthSession.userId == models.AuthUser.id)
            .where(
                models.AuthSession.tokenHash == token_digest(token),
                models.AuthSession.revokedAt.is_(None),
                models.AuthSession.expiresAt > now,
            )
        )
        row = db.execute(statement).first()
        if row is None:
            return None
        session, user = row
        if user.disabled or user.role not in RULES:
            return None
        session.lastUsedAt = now
        db.commit()
        return {
            "userId": str(user.id),
            "email": user.email,
            "role": user.role,
            "source": "session",
            "sessionId": session.id,
            "expiresAt": session.expiresAt.isoformat(),
        }


def authenticate(header: str | None) -> dict[str, Any] | None:
    token = token_from_header(header)
    if not token:
        return None
    return authenticate_static(token) or authenticate_session(token)


def has_configured_identity() -> bool:
    if static_identities():
        return True
    with SessionLocal() as db:
        return int(db.scalar(select(func.count()).select_from(models.AuthUser)) or 0) > 0


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


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if request.method == "OPTIONS" or path in PUBLIC_PATHS:
            return await call_next(request)
        identity = authenticate(request.headers.get("authorization"))
        if not auth_enabled():
            if identity is not None:
                request.state.identity = identity
            return await call_next(request)
        if identity is None:
            if not has_configured_identity():
                return JSONResponse({"error": "AUTH_NOT_CONFIGURED"}, status_code=503)
            return JSONResponse({"error": "UNAUTHORIZED"}, status_code=401)
        request.state.identity = identity
        resolved = resolve_action(request.method, path)
        if resolved is not None:
            entity, action = resolved
            if action not in RULES.get(identity["role"], {}).get(entity, []):
                return JSONResponse({"error": "FORBIDDEN"}, status_code=403)
        return await call_next(request)
`)

  return [text('apps/api/app/session_auth.py', `from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from . import models
from .auth import auth_enabled
from .database import SessionLocal

router = APIRouter(prefix="/api/auth")
BOOTSTRAP_ROLE = ${role}
SESSION_TTL_SECONDS = ${access.session!.ttlSeconds}
MAX_ACTIVE_SESSIONS = ${access.session!.maxActiveSessions}


class LoginInput(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=12, max_length=1024)


def password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 600_000, dklen=32)
    return "pbkdf2_sha256$600000$" + salt.hex() + "$" + derived.hex()


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations_text, salt_hex, hash_hex = stored.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_text)
        expected = bytes.fromhex(hash_hex)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), iterations, dklen=len(expected))
        return hmac.compare_digest(expected, actual)
    except (TypeError, ValueError):
        return False


def issue_session(db: Session, user_id: int, current_session_id: int | None = None) -> tuple[str, datetime]:
    now = datetime.now(timezone.utc)
    if current_session_id is not None:
        db.execute(update(models.AuthSession).where(
            models.AuthSession.id == current_session_id,
            models.AuthSession.revokedAt.is_(None),
        ).values(revokedAt=now))
    active = list(db.scalars(select(models.AuthSession).where(
        models.AuthSession.userId == user_id,
        models.AuthSession.revokedAt.is_(None),
        models.AuthSession.expiresAt > now,
    ).order_by(models.AuthSession.createdAt.asc())))
    revoke_count = max(0, len(active) - MAX_ACTIVE_SESSIONS + 1)
    for session in active[:revoke_count]:
        session.revokedAt = now
    token = secrets.token_urlsafe(32)
    expires_at = now + timedelta(seconds=SESSION_TTL_SECONDS)
    db.add(models.AuthSession(
        tokenHash=hashlib.sha256(token.encode()).hexdigest(),
        userId=user_id,
        expiresAt=expires_at,
        revokedAt=None,
        lastUsedAt=now,
        createdAt=now,
    ))
    db.commit()
    return token, expires_at


def public_identity(identity: dict[str, Any]) -> dict[str, str]:
    return {key: str(identity[key]) for key in ("userId", "email", "role")}


@router.post("/bootstrap", status_code=201)
def bootstrap():
    email = os.getenv("AUTH_BOOTSTRAP_EMAIL", "").strip().lower()
    password = os.getenv("AUTH_BOOTSTRAP_PASSWORD", "")
    if "@" not in email or len(password) < 12 or any(marker in password.lower() for marker in ("replace-with", "changeme", "example")):
        return JSONResponse({"error": "BOOTSTRAP_NOT_CONFIGURED"}, status_code=503)
    with SessionLocal() as db:
        if int(db.scalar(select(func.count()).select_from(models.AuthUser)) or 0) > 0:
            return JSONResponse({"error": "BOOTSTRAP_ALREADY_COMPLETED"}, status_code=409)
        now = datetime.now(timezone.utc)
        user = models.AuthUser(email=email, passwordHash=password_hash(password), role=BOOTSTRAP_ROLE, disabled=False, createdAt=now, updatedAt=now)
        db.add(user)
        db.commit()
        db.refresh(user)
        return {"created": True, "identity": {"userId": str(user.id), "email": user.email, "role": user.role}}


@router.post("/login")
def login(payload: LoginInput):
    with SessionLocal() as db:
        email = payload.email.strip().lower()
        if "@" not in email:
            return JSONResponse({"error": "INVALID_CREDENTIALS"}, status_code=401)
        user = db.scalar(select(models.AuthUser).where(models.AuthUser.email == email))
        if user is None or user.disabled or not verify_password(payload.password, user.passwordHash):
            return JSONResponse({"error": "INVALID_CREDENTIALS"}, status_code=401)
        token, expires_at = issue_session(db, user.id)
        return {"token": token, "expiresAt": expires_at.isoformat(), "identity": {"userId": str(user.id), "email": user.email, "role": user.role}}


@router.get("/me")
def me(request: Request):
    identity = getattr(request.state, "identity", None)
    return {
        "enabled": auth_enabled(),
        "identity": public_identity(identity) if identity else None,
        "source": identity.get("source") if identity else None,
        "expiresAt": identity.get("expiresAt") if identity else None,
    }


@router.post("/logout", status_code=204)
def logout(request: Request):
    identity = getattr(request.state, "identity", None)
    if not identity or not identity.get("sessionId"):
        return JSONResponse({"error": "SESSION_REQUIRED"}, status_code=409)
    with SessionLocal() as db:
        db.execute(update(models.AuthSession).where(
            models.AuthSession.id == int(identity["sessionId"]),
            models.AuthSession.revokedAt.is_(None),
        ).values(revokedAt=datetime.now(timezone.utc)))
        db.commit()
    return Response(status_code=204)


@router.post("/rotate")
def rotate(request: Request):
    identity = getattr(request.state, "identity", None)
    if not identity or not identity.get("sessionId"):
        return JSONResponse({"error": "SESSION_REQUIRED"}, status_code=409)
    with SessionLocal() as db:
        token, expires_at = issue_session(db, int(identity["userId"]), int(identity["sessionId"]))
    return {"token": token, "expiresAt": expires_at.isoformat(), "identity": public_identity(identity)}


@router.post("/revoke-all", status_code=204)
def revoke_all(request: Request):
    identity = getattr(request.state, "identity", None)
    if not identity or not identity.get("sessionId"):
        return JSONResponse({"error": "SESSION_REQUIRED"}, status_code=409)
    with SessionLocal() as db:
        db.execute(update(models.AuthSession).where(
            models.AuthSession.userId == int(identity["userId"]),
            models.AuthSession.revokedAt.is_(None),
        ).values(revokedAt=datetime.now(timezone.utc)))
        db.commit()
    return Response(status_code=204)
`)]
}
