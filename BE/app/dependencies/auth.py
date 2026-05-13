from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.core.token_store import is_access_token_revoked
from app.db.session import get_db
from app.models import User


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _ensure_user_can_access(db: Session, user_id: int) -> None:
    user = db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    now = datetime.now(timezone.utc)
    suspended_until = _as_utc(user.suspended_until) if user.suspended_until is not None else None
    if suspended_until is not None and suspended_until <= now:
        user.is_active = True
        user.suspended_until = None
        user.suspension_reason = None
        db.commit()
        return

    if not user.is_active:
        detail = "Inactive user"
        if suspended_until is not None:
            detail = {
                "message": "Suspended user",
                "suspended_until": suspended_until.isoformat(),
                "reason": user.suspension_reason,
            }
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def get_current_user_id(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> int:
    """Extract and verify Bearer access token."""
    if authorization is None or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer token",
        )

    token = authorization.split(" ", 1)[1].strip()
    if is_access_token_revoked(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token revoked",
        )

    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    sub = payload.get("sub")
    if not sub or not str(sub).isdigit():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid subject",
        )
    user_id = int(sub)
    _ensure_user_can_access(db, user_id)
    return user_id


def get_current_user_id_from_token(token: str) -> int:
    """Extract and verify an access token passed directly as a string."""
    if is_access_token_revoked(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token revoked",
        )

    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    sub = payload.get("sub")
    if not sub or not str(sub).isdigit():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid subject",
        )
    return int(sub)
