import type { ArtifactFile, ManualAccessDefinition, ManualEntityDefinition } from 'shared'
import { replaceFile } from './manualAuthCommon'
import { text } from './manualCrudHelpers'
import { sessionBootstrapRole } from './manualSessionRuntimeCommon'
import { AUDIT_RETENTION_DAYS, LOGIN_LOCKOUT_SECONDS, LOGIN_WINDOW_SECONDS, MAX_LOGIN_ATTEMPTS, SESSION_RETENTION_DAYS } from './manualSessionProtectionCommon'

export function fastApiProtection(files: ArtifactFile[], access: ManualAccessDefinition, entities: readonly ManualEntityDefinition[]): ArtifactFile[] {
  const role = JSON.stringify(sessionBootstrapRole(access, entities))
  replaceFile(files, 'apps/api/app/models.py', (content) => `${content.trimEnd()}

class AuthLoginEvent(Base):
    __tablename__ = "auth_login_events"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    principalHash: Mapped[str] = mapped_column("principal_hash", Text, nullable=False, index=True)
    networkHash: Mapped[str] = mapped_column("network_hash", Text, nullable=False, index=True)
    outcome: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime] = mapped_column("created_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
`)
  replaceFile(files, 'apps/api/app/session_auth.py', (content) => content
    .replace('from .database import SessionLocal', 'from .database import SessionLocal\nfrom .auth_protection import LoginRateLimited, cleanup_security_data, client_network, login_gate, record_login_event')
    .replace('def login(payload: LoginInput):', 'def login(payload: LoginInput, request: Request):')
    .replace(
      '        email = payload.email.strip().lower()\n        if "@" not in email:',
      '        email = payload.email.strip().lower()\n        network = client_network(request)\n        try: login_gate(email, network)\n        except LoginRateLimited as error: record_login_event(db, email, network, "rate_limited"); return JSONResponse({"error":"LOGIN_RATE_LIMITED", "retryAfterSeconds":error.retry_after_seconds}, status_code=429, headers={"Retry-After":str(error.retry_after_seconds)})\n        if "@" not in email:',
    )
    .replace(
      '            return JSONResponse({"error": "INVALID_CREDENTIALS"}, status_code=401)\n        token, expires_at = issue_session(db, user.id)',
      '            record_login_event(db, email, network, "failure")\n            return JSONResponse({"error": "INVALID_CREDENTIALS"}, status_code=401)\n        record_login_event(db, email, network, "success")\n        cleanup_security_data(db)\n        token, expires_at = issue_session(db, user.id)',
    )
    .replace(
      '@router.post("/revoke-all", status_code=204)',
      `@router.post("/maintenance/cleanup")
def maintenance_cleanup(request: Request):
    identity = getattr(request.state, "identity", None)
    if not identity or identity.get("role") != ${role}:
        return JSONResponse({"error":"FORBIDDEN"}, status_code=403)
    with SessionLocal() as db:
        return cleanup_security_data(db, force=True)


@router.post("/revoke-all", status_code=204)`,
    ))
  return [
    text('apps/api/app/auth_protection.py', `from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Literal

from fastapi import Request
from sqlalchemy import delete, or_
from sqlalchemy.orm import Session

from . import models

Outcome = Literal["success", "failure", "rate_limited"]
ATTEMPTS: dict[str, dict[str, object]] = {}
ATTEMPT_LOCK = Lock()
EPHEMERAL_KEY: bytes | None = None
LAST_CLEANUP = 0.0

class LoginRateLimited(Exception):
    def __init__(self, retry_after_seconds: int): self.retry_after_seconds = retry_after_seconds

def integer(name: str, fallback: int) -> int:
    try: value = int(os.getenv(name, "")); return value if value > 0 else fallback
    except ValueError: return fallback

def audit_key() -> bytes:
    global EPHEMERAL_KEY
    raw = os.getenv("AUTH_AUDIT_HASH_KEY", "")
    if len(raw) >= 32 and not any(marker in raw.lower() for marker in ("replace-with", "changeme", "example")): return raw.encode()
    if EPHEMERAL_KEY is None: EPHEMERAL_KEY = secrets.token_bytes(32); print("AUTH_AUDIT_HASH_KEY is not configured; audit hashes rotate when this process restarts")
    return EPHEMERAL_KEY

def digest(scope: str, value: str) -> str: return hmac.new(audit_key(), (scope + "\\0" + value).encode(), hashlib.sha256).hexdigest()
def client_network(request: Request) -> str:
    trusted = os.getenv("AUTH_TRUST_PROXY", "").lower() in {"1", "true", "yes", "on"}
    if trusted: return request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return request.client.host if request.client else ""
def keys(email: str, network: str) -> list[str]: return [digest("principal", email)] + ([digest("network", network)] if network else [])

def login_gate(email: str, network: str) -> None:
    now_value = time.time()
    window = integer("AUTH_LOGIN_WINDOW_SECONDS", ${LOGIN_WINDOW_SECONDS})
    lockout = integer("AUTH_LOGIN_LOCKOUT_SECONDS", ${LOGIN_LOCKOUT_SECONDS})
    maximum = integer("AUTH_MAX_LOGIN_ATTEMPTS", ${MAX_LOGIN_ATTEMPTS})
    retry = 0
    with ATTEMPT_LOCK:
        for key in keys(email, network):
            state = ATTEMPTS.setdefault(key, {"failures": [], "locked_until": 0.0})
            failures = [stamp for stamp in state["failures"] if float(stamp) > now_value - window]
            state["failures"] = failures
            locked_until = float(state["locked_until"])
            if locked_until > now_value: retry = max(retry, int(locked_until - now_value + 0.999))
            elif len(failures) >= maximum: state["locked_until"] = now_value + lockout; retry = max(retry, lockout)
    if retry: raise LoginRateLimited(retry)

def record_login_event(db: Session, email: str, network: str, outcome: Outcome) -> None:
    now = time.time()
    with ATTEMPT_LOCK:
        if outcome == "failure":
            for key in keys(email, network): ATTEMPTS.setdefault(key, {"failures": [], "locked_until": 0.0})["failures"].append(now)
        elif outcome == "success":
            for key in keys(email, network): ATTEMPTS.pop(key, None)
    principal_hash, network_hash = digest("principal", email), digest("network", network) if network else ""
    db.add(models.AuthLoginEvent(principalHash=principal_hash, networkHash=network_hash, outcome=outcome, createdAt=datetime.now(timezone.utc)))
    db.commit()
    print({"event":"auth.login", "outcome":outcome, "principalHash":principal_hash, "networkHash":network_hash, "at":datetime.now(timezone.utc).isoformat()})

def cleanup_security_data(db: Session, force: bool = False) -> dict[str, object]:
    global LAST_CLEANUP
    now = time.time()
    if not force and now - LAST_CLEANUP < 3600: return {"completed": True, "skipped": True}
    LAST_CLEANUP = now
    audit_cutoff = datetime.now(timezone.utc) - timedelta(days=integer("AUTH_AUDIT_RETENTION_DAYS", ${AUDIT_RETENTION_DAYS}))
    session_cutoff = datetime.now(timezone.utc) - timedelta(days=integer("AUTH_SESSION_RETENTION_DAYS", ${SESSION_RETENTION_DAYS}))
    event_result = db.execute(delete(models.AuthLoginEvent).where(models.AuthLoginEvent.createdAt < audit_cutoff))
    session_result = db.execute(delete(models.AuthSession).where(or_(models.AuthSession.expiresAt < session_cutoff, models.AuthSession.revokedAt < session_cutoff)))
    db.commit()
    return {"completed": True, "loginEventsDeleted": event_result.rowcount or 0, "sessionsDeleted": session_result.rowcount or 0}
`),
    text('apps/api/migrations/versions/0003_auth_login_events.py', `"""create authentication login audit events"""
from alembic import op
import sqlalchemy as sa
revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table("auth_login_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("principal_hash", sa.Text(), nullable=False),
        sa.Column("network_hash", sa.Text(), nullable=False),
        sa.Column("outcome", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("auth_login_events_principal_created_idx", "auth_login_events", ["principal_hash", "created_at"])
    op.create_index("auth_login_events_network_created_idx", "auth_login_events", ["network_hash", "created_at"])
    op.create_index("auth_login_events_created_idx", "auth_login_events", ["created_at"])

def downgrade() -> None:
    op.drop_table("auth_login_events")
`),
  ]
}
