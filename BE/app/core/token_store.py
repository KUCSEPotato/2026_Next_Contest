from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.config import settings

try:
    from redis import Redis as RedisClient  # type: ignore[import-not-found]
    from redis.exceptions import RedisError  # type: ignore[import-not-found]
except Exception:  # pragma: no cover - optional dependency fallback
    RedisClient = None

    class RedisError(Exception):
        pass


REFRESH_TOKEN_TTL_SECONDS = 14 * 24 * 60 * 60

_memory_password_reset_tokens: dict[str, dict[str, datetime | int]] = {}
_memory_refresh_token_store: dict[str, dict[str, datetime | int]] = {}
_memory_revoked_access_tokens: dict[str, datetime | None] = {}
_memory_revoked_refresh_tokens: dict[str, datetime | None] = {}
_redis_client: Any = None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _seconds_until(expires_at: datetime) -> int:
    seconds = int((expires_at - _utcnow()).total_seconds())
    return max(1, seconds)


def _redis() -> Any:
    global _redis_client
    if RedisClient is None or not settings.redis_url:
        return None
    if _redis_client is None:
        try:
            _redis_client = RedisClient.from_url(settings.redis_url, decode_responses=True)
            _redis_client.ping()
        except Exception:
            _redis_client = None
    return _redis_client


def _password_reset_key(token: str) -> str:
    return f"password_reset:{token}"


def _refresh_token_key(token: str) -> str:
    return f"refresh_token:{token}"


def _revoked_access_key(token: str) -> str:
    return f"revoked_access:{token}"


def _revoked_refresh_key(token: str) -> str:
    return f"revoked_refresh:{token}"


def set_password_reset_token(token: str, user_id: int, expires_at: datetime) -> None:
    payload = {"user_id": user_id, "expires_at": expires_at.isoformat()}
    client = _redis()
    if client is not None:
        try:
            client.set(_password_reset_key(token), json.dumps(payload), ex=_seconds_until(expires_at))
            return
        except RedisError:
            pass
    _memory_password_reset_tokens[token] = {"user_id": user_id, "expires_at": expires_at}


def get_password_reset_token(token: str) -> dict[str, datetime | int] | None:
    client = _redis()
    if client is not None:
        try:
            raw_value = client.get(_password_reset_key(token))
            if raw_value is not None:
                data = json.loads(raw_value)
                return {
                    "user_id": int(data["user_id"]),
                    "expires_at": datetime.fromisoformat(data["expires_at"]),
                }
        except RedisError:
            pass

    token_data = _memory_password_reset_tokens.get(token)
    if token_data is None:
        return None

    expires_at = token_data["expires_at"]
    if isinstance(expires_at, datetime) and expires_at <= _utcnow():
        _memory_password_reset_tokens.pop(token, None)
        return None
    return token_data


def delete_password_reset_token(token: str) -> None:
    client = _redis()
    if client is not None:
        try:
            client.delete(_password_reset_key(token))
        except RedisError:
            pass
    _memory_password_reset_tokens.pop(token, None)


def store_refresh_token(token: str, user_id: int) -> None:
    expires_at = _utcnow() + timedelta(seconds=REFRESH_TOKEN_TTL_SECONDS)

    client = _redis()
    if client is not None:
        try:
            client.set(
                _refresh_token_key(token),
                json.dumps({
                    "user_id": user_id,
                    "expires_at": expires_at.isoformat(),
                }),
                ex=REFRESH_TOKEN_TTL_SECONDS,
            )
            return
        except RedisError:
            pass

    _memory_refresh_token_store[token] = {
        "user_id": user_id,
        "expires_at": expires_at,
    }


def get_refresh_token_user_id(token: str) -> int | None:
    client = _redis()
    if client is not None:
        try:
            raw_value = client.get(_refresh_token_key(token))
            if raw_value is not None:
                data = json.loads(raw_value)
                expires_at = datetime.fromisoformat(data["expires_at"])
                if expires_at <= _utcnow():
                    client.delete(_refresh_token_key(token))
                    return None
                return int(data["user_id"])
        except RedisError:
            pass

    token_data = _memory_refresh_token_store.get(token)
    if token_data is None:
        return None

    expires_at = token_data["expires_at"]
    if isinstance(expires_at, datetime) and expires_at <= _utcnow():
        _memory_refresh_token_store.pop(token, None)
        return None
    return int(token_data["user_id"])


def delete_refresh_token(token: str) -> None:
    client = _redis()
    if client is not None:
        try:
            client.delete(_refresh_token_key(token))
        except RedisError:
            pass
    _memory_refresh_token_store.pop(token, None)


def revoke_access_token(token: str, expires_at: datetime | None = None) -> None:
    client = _redis()
    if client is not None:
        try:
            ttl = _seconds_until(expires_at) if expires_at is not None else REFRESH_TOKEN_TTL_SECONDS
            client.set(_revoked_access_key(token), "1", ex=ttl)
            return
        except RedisError:
            pass
    _memory_revoked_access_tokens[token] = expires_at


def is_access_token_revoked(token: str) -> bool:
    client = _redis()
    if client is not None:
        try:
            return client.exists(_revoked_access_key(token)) > 0
        except RedisError:
            pass

    expires_at = _memory_revoked_access_tokens.get(token)
    if expires_at is None:
        return token in _memory_revoked_access_tokens
    if expires_at <= _utcnow():
        _memory_revoked_access_tokens.pop(token, None)
        return False
    return True


def revoke_refresh_token(token: str, expires_at: datetime | None = None) -> None:
    delete_refresh_token(token)
    client = _redis()
    if client is not None:
        try:
            ttl = _seconds_until(expires_at) if expires_at is not None else REFRESH_TOKEN_TTL_SECONDS
            client.set(_revoked_refresh_key(token), "1", ex=ttl)
            return
        except RedisError:
            pass
    _memory_revoked_refresh_tokens[token] = expires_at


def is_refresh_token_revoked(token: str) -> bool:
    client = _redis()
    if client is not None:
        try:
            return client.exists(_revoked_refresh_key(token)) > 0
        except RedisError:
            pass

    expires_at = _memory_revoked_refresh_tokens.get(token)
    if expires_at is None:
        return token in _memory_revoked_refresh_tokens
    if expires_at <= _utcnow():
        _memory_revoked_refresh_tokens.pop(token, None)
        return False
    return True
