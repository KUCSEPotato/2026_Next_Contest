# Devory / Next Contest

프로젝트 협업과 팀 기반 개발 경험을 관리하기 위한 백엔드 서비스입니다.
FastAPI, PostgreSQL, Redis를 중심으로 인증, 프로젝트/팀 협업, 추천, 채팅, 알림, 구독 기능을 제공합니다.

## 한눈에 보는 안내

BE 하위에 분리된 운영 문서를 메인 README에서 바로 찾을 수 있도록 통합했습니다.

- 빠른 실행: 아래 `로컬 실행`과 `Docker 실행`
- DB 설계/적용: 아래 `DB 스키마 및 적용 가이드`
- 마이그레이션 정책: 아래 `마이그레이션 전략`
- 상세 문서 원문:
	- [BE/docker/README.md](BE/docker/README.md)
	- [BE/docs/db/README.md](BE/docs/db/README.md)
	- [BE/migrations/README.md](BE/migrations/README.md)

## 개요

- API 프레임워크: FastAPI
- ORM: SQLAlchemy
- 영속 데이터 저장소: PostgreSQL
- 토큰 상태 저장소: Redis
- 유효성 검증: Pydantic
- 컨테이너: Docker, Docker Compose
- 관측성: Prometheus, Grafana

## 주요 기능

- 회원가입, 로그인, 로그아웃, 비밀번호 재설정
- GitHub/Google OAuth 로그인 (Authorization Code Flow)
- 기존 계정 OAuth 연결/해제
- Access/Refresh 토큰 발급 및 revoke
- 아이디어, 프로젝트, 지원/초대, 멤버 관리
- 투두, 회고, 실패 경험, 리뷰/평점
- 추천, 검색, 알림, 채팅, 구독, 관리자 기능

## 프로젝트 구조

```text
.
├── BE/
│   ├── app/
│   ├── docker/
│   ├── docs/
│   ├── migrations/
│   └── requirements.txt
├── README.md
└── idea/
```

## 로컬 실행

### 1) 환경 파일 준비

```bash
cd BE
cp .env.example .env
```

### 2) 의존성 설치

```bash
cd BE
pip install -r requirements.txt
```

### 3) 서버 실행

```bash
cd BE
uvicorn app.main:app --reload
```

### 4) 접속 주소

- API: http://127.0.0.1:8000
- Swagger: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc
- Metrics: http://127.0.0.1:8000/metrics

## Docker 실행

Compose는 PostgreSQL, Redis, API, Prometheus, Grafana를 함께 기동합니다.

```bash
cd BE
cp .env.example .env
cd docker
docker compose up -d --build
```

상태/로그:

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f db
docker compose logs -f redis
docker compose logs -f prometheus
docker compose logs -f grafana
```

중지/초기화:

```bash
docker compose down
docker compose down -v --remove-orphans
```

## DB 스키마 및 적용 가이드

DB 관련 산출물은 [BE/docs/db](BE/docs/db)에 있습니다.

- [BE/docs/db/01_postgresql_schema.sql](BE/docs/db/01_postgresql_schema.sql): 전체 테이블/제약조건/인덱스/트리거 DDL
- [BE/docs/db/02_erd.md](BE/docs/db/02_erd.md): 핵심 테이블 관계 ERD
- [BE/docs/db/03_add_idea_tech_stack_hashtags.sql](BE/docs/db/03_add_idea_tech_stack_hashtags.sql): 기존 ideas 보정 스크립트
- [BE/docs/db/04_postgresql_schema_with_idea_tech_stack_hashtags_backfill.sql](BE/docs/db/04_postgresql_schema_with_idea_tech_stack_hashtags_backfill.sql): 01+03 통합 보조 스크립트

기본 적용 순서:

1. PostgreSQL 데이터베이스 생성
2. 01_postgresql_schema.sql 실행
3. 기존 DB를 운영 중이면 03_add_idea_tech_stack_hashtags.sql 추가 실행
4. 02_erd.md로 구조 검토

통합 실행 옵션:

- 전체 스키마 + ideas 보정을 한 번에 적용하려면 04_postgresql_schema_with_idea_tech_stack_hashtags_backfill.sql 실행
- 이 파일은 실행 편의용 보조 스크립트이며, 기존 01/03 문서를 대체하지 않습니다.

설계 원칙:

- soft delete: 주요 테이블에 deleted_at 컬럼
- 감사 추적: created_at, updated_at
- 성능: 조회 패턴 기반 인덱스 선반영
- 데이터 무결성: UNIQUE, CHECK, FK 제약 적극 사용

## 마이그레이션 전략

- 마이그레이션 작업 위치: [BE/migrations](BE/migrations)
- 현재 상태: [BE/migrations/README.md](BE/migrations/README.md) 기준, Alembic 마이그레이션 파일을 둘 위치로 정의되어 있습니다.
- 권장 방향: 신규 스키마 변경은 SQL 문서 수동 반영과 함께 Alembic revision으로 이중 관리하지 말고, Alembic 기준 단일 흐름으로 정리해 누락을 줄이는 것이 좋습니다.

## 개발/배포 환경 분리 (Dev vs Prod)

| 항목 | Dev (로컬/테스트) | Prod (배포) |
|---|---|---|
| 환경 파일 | `BE/.env.example` 기반 `BE/.env` | `BE/.env.production.example` 기반 실제 비밀값 |
| DB 주소 | `postgresql+psycopg2://...@127.0.0.1:5432/...` 또는 `@db:5432` | 관리형 DB 엔드포인트(RDS/Cloud SQL 등) |
| Redis 주소 | `redis://127.0.0.1:6379/0` 또는 `redis://redis:6379/0` | 운영 Redis 엔드포인트 |
| JWT 시크릿 | 임시값 가능 | 강한 랜덤 시크릿 필수 |
| OAuth Redirect URI | 로컬 callback (`127.0.0.1`) | 실제 서비스 도메인 callback |
| 관측성 | 로컬 포트 확인 중심 | 내부망/보안그룹 기반 접근 제어 |
| 로그/재시작 | 개발 편의 중심 | 장애 대응, 보존 정책, 알림 연동 |

배포 전 체크리스트:

1. `BE/.env.production.example` placeholder를 실제 운영값으로 교체
2. OAuth Redirect URI와 운영 프론트 callback URL 일치 확인
3. JWT/DB/Redis/Grafana 계정 비밀값 강화
4. `docker compose config`로 구성 검증 후 기동
5. `/health`, `/metrics`, 로그인/로그아웃, refresh, OAuth 플로우 점검

## 모니터링

- API Metrics: http://127.0.0.1:8000/metrics
- Prometheus: http://127.0.0.1:9090
- Grafana: http://127.0.0.1:3001

Prometheus scrape 설정은 [BE/docker/monitoring/prometheus.yml](BE/docker/monitoring/prometheus.yml)에서 관리합니다.

## 핵심 문서 인덱스

- [BE/app/api/API_CATALOG.md](BE/app/api/API_CATALOG.md): API 카탈로그
- [BE/docs/SWAGGER_TEST_GUIDE.md](BE/docs/SWAGGER_TEST_GUIDE.md): Swagger 테스트 시나리오
- [BE/docs/db/README.md](BE/docs/db/README.md): DB 설계 패키지 안내
- [BE/docs/db/REDIS_GUIDE.md](BE/docs/db/REDIS_GUIDE.md): Redis 사용 가이드
- [BE/docker/README.md](BE/docker/README.md): Docker 실행 가이드
- [BE/migrations/README.md](BE/migrations/README.md): 마이그레이션 폴더 정책

## 인증/OAuth API 요약

- 로그인/토큰: /api/v1/auth/login, /api/v1/auth/token/refresh, /api/v1/auth/logout
- OAuth 로그인: /api/v1/auth/oauth/github, /api/v1/auth/oauth/google
- OAuth 연결/해제:
	- GET /api/v1/auth/oauth/links
	- POST /api/v1/auth/oauth/link/github
	- POST /api/v1/auth/oauth/link/google
	- DELETE /api/v1/auth/oauth/unlink/github
	- DELETE /api/v1/auth/oauth/unlink/google

상세 예시는 [BE/docs/SWAGGER_TEST_GUIDE.md](BE/docs/SWAGGER_TEST_GUIDE.md)를 참고하세요.