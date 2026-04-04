# Redis Local Guide

Redis is used for:
- access token revoke tracking
- refresh token revoke tracking
- password reset token storage

## 1) Start Redis

If you use Docker Compose:

```bash
cd docker
docker compose up -d
```

This starts PostgreSQL, Redis, and the API together.

## 2) Configure env

For local development:

```env
REDIS_URL=redis://127.0.0.1:6379/0
```

For Docker Compose:

```env
REDIS_URL=redis://redis:6379/0
```

## 3) Install dependency

If you run the API outside Docker:

```bash
pip install redis
```

Or install the full backend dependencies:

```bash
pip install -r requirements.txt
```

## 4) What changes in the app

- Logout can revoke the current access token and refresh token.
- Authentication checks reject revoked access tokens.
- Password reset tokens are stored with TTL instead of only in memory.
