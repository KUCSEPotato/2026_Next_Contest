# Docker PostgreSQL Local Guide

## 1) Start DB

Run in BE/docker directory:

```bash
cd docker
docker compose up -d
```

Check status:

```bash
cd docker
docker compose ps
```

The first startup runs:
- `docs/db/01_postgresql_schema.sql`
- and creates all tables/types/indexes.

Redis is started alongside PostgreSQL in the same compose stack and is used for:
- access token revoke tracking
- refresh token revoke tracking
- password reset token storage

## 2) Configure backend env

Create `.env` in BE directory (copy from `.env.example`):

```bash
cp .env.example .env
```

Default DB URL:

```env
DATABASE_URL=postgresql+psycopg2://devory:devory1234@127.0.0.1:5432/devory
```

Default Redis URL:

```env
REDIS_URL=redis://127.0.0.1:6379/0
```

## 3) Install DB driver

If not installed yet:

```bash
pip install psycopg2-binary
```

## 4) Run backend

```bash
uvicorn app.main:app --reload
```

## 5) Connect manually (optional)

```bash
docker exec -it devory-postgres psql -U devory -d devory
```

## 6) Reset DB cleanly (schema re-init)

```bash
cd docker
docker compose down -v
docker compose up -d
```

## Notes

- `01_postgresql_schema.sql` is executed only when DB volume is first initialized.
- If schema file changes, use reset commands above.
- Current app also runs SQLAlchemy `create_all` on startup, but with pre-created schema this is mostly no-op.
