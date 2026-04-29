# Devory / Next Contest

프로젝트 협업과 팀 기반 개발 경험을 관리하기 위한 백엔드 서비스입니다.
FastAPI, PostgreSQL, Redis를 중심으로 인증, 프로젝트/팀 협업, 추천, 채팅, 알림, 구독 기능을 제공합니다.

## 개요

- API 프레임워크: FastAPI
- 영속 데이터 저장소: PostgreSQL
- 토큰 상태 저장소: Redis
- API 문서: Swagger, ReDoc
- 모니터링: Prometheus, Grafana (Docker Compose 포함)

## 주요 기능

- 회원가입, 로그인, 로그아웃, 비밀번호 재설정
- GitHub/Google OAuth 로그인 (Authorization Code Flow)
- 기존 계정 OAuth 연결/해제
- Access/Refresh 토큰 발급 및 revoke
- 아이디어, 프로젝트, 지원/초대, 멤버 관리
- 투두, 회고, 실패 경험, 리뷰/평점
- 추천, 검색, 알림, 채팅, 구독, 관리자 기능

## 기술 스택

- Backend: FastAPI
- ORM: SQLAlchemy
- DB: PostgreSQL
- Token Store: Redis
- Validation: Pydantic
- Container: Docker, Docker Compose
- Monitoring: Prometheus, Grafana

## 프로젝트 구조

```text
.
├── BE/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── dependencies/
│   │   ├── models/
│   │   ├── schemas/
│   │   └── services/
│   ├── docker/
│   │   └── monitoring/
│   ├── docs/
│   ├── migrations/
│   └── requirements.txt
├── README.md
└── idea/
```

## 핵심 문서

- [BE/app/api/API_CATALOG.md](BE/app/api/API_CATALOG.md): API 동작 카탈로그
- [BE/docs/SWAGGER_TEST_GUIDE.md](BE/docs/SWAGGER_TEST_GUIDE.md): Swagger 테스트 가이드
- [BE/docs/db/README.md](BE/docs/db/README.md): DB 운영 원칙
- [BE/docs/db/REDIS_GUIDE.md](BE/docs/db/REDIS_GUIDE.md): Redis 사용 가이드
- [BE/docker/README.md](BE/docker/README.md): Docker 실행 가이드

## 빠른 시작 (로컬)

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

Compose는 기본적으로 PostgreSQL, Redis, API, Prometheus, Grafana를 함께 기동합니다.

```bash
cd BE/docker
docker compose up -d --build
```

상태 확인:

```bash
docker compose ps
```

로그 확인:

```bash
docker compose logs -f api
docker compose logs -f db
docker compose logs -f redis
docker compose logs -f prometheus
docker compose logs -f grafana
```

중지:

```bash
docker compose down
```

볼륨 포함 초기화:

```bash
docker compose down -v --remove-orphans
```

## 개발/배포 환경 분리 (Dev vs Prod)

| 항목 | Dev (로컬/테스트) | Prod (배포) |
|---|---|---|
| 환경 파일 | `BE/.env.example` 기반 `BE/.env` | `BE/.env.production.example` 기반 실제 비밀값 |
| DB 주소 | `postgresql+psycopg2://...@127.0.0.1:5432/...` 또는 `@db:5432` | 관리형 DB 엔드포인트(RDS/Cloud SQL 등) |
| Redis 주소 | `redis://127.0.0.1:6379/0` 또는 `redis://redis:6379/0` | 운영 Redis 엔드포인트 |
| JWT 시크릿 | 임시값 가능 | 강한 랜덤 시크릿 필수 |
| OAuth Redirect URI | 로컬 프론트 callback (`127.0.0.1`) | 실제 서비스 도메인 callback |
| 관측성 | Prometheus/Grafana 로컬 포트 확인용 | 내부망/보안그룹 기반 접근 제어 |
| 로그/재시작 | 개발 편의 중심 | 장애 대응, 보존 정책, 알림 연동 |

배포 전 체크리스트:

1. `BE/.env.production.example`의 placeholder를 실제 운영값으로 교체
2. GitHub/Google OAuth 콘솔의 Redirect URI와 운영 프론트 callback URL 일치 확인
3. `JWT_SECRET_KEY`, DB/Redis 비밀번호, Grafana admin 계정 강한 값 적용
4. `docker compose config`로 구성 검증 후 기동
5. `/health`, `/metrics`, 로그인/로그아웃, token refresh, OAuth 로그인 플로우 점검

배포 시 기본 실행:

```bash
cd BE/docker
docker compose up -d --build
docker compose ps
```

## 모니터링

- API Metrics: http://127.0.0.1:8000/metrics
- Prometheus: http://127.0.0.1:9090
- Grafana: http://127.0.0.1:3001

Prometheus scrape 설정은 [BE/docker/monitoring/prometheus.yml](BE/docker/monitoring/prometheus.yml)에서 관리합니다.

## 환경 변수 요약

기본 값은 [BE/.env.example](BE/.env.example), 배포 예시는 [BE/.env.production.example](BE/.env.production.example)을 기준으로 사용합니다.

필수 항목:

- DATABASE_URL
- REDIS_URL
- JWT_SECRET_KEY
- GITHUB_OAUTH_CLIENT_ID
- GITHUB_OAUTH_CLIENT_SECRET
- GITHUB_OAUTH_REDIRECT_URI
- GOOGLE_OAUTH_CLIENT_ID
- GOOGLE_OAUTH_CLIENT_SECRET
- GOOGLE_OAUTH_REDIRECT_URI

모니터링 관련(선택):

- PROMETHEUS_PORT (기본 9090)
- GRAFANA_PORT (기본 3001)
- GRAFANA_ADMIN_USER
- GRAFANA_ADMIN_PASSWORD

주의:

- OAuth Redirect URI는 프론트엔드 callback URL과 정확히 일치해야 합니다.
- 운영 환경에서는 JWT_SECRET_KEY를 강한 랜덤 값으로 반드시 교체해야 합니다.

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

## 현재 상태

- 인증: 이메일/닉네임 + 비밀번호, GitHub/Google OAuth 구현 완료
- 토큰 정책: 로그아웃 시 access/refresh revoke 처리 + Redis 저장
- 인프라: PostgreSQL/Redis/API Docker Compose 구성 완료
- 모니터링: Prometheus/Grafana 및 /metrics 노출 반영 완료

## 다음 개선 우선순위

- OAuth state/PKCE 검증 로직 강화
- 비밀번호 해시를 bcrypt/argon2로 전환
- Alembic 기반 마이그레이션 체계 도입
- 요청 추적 ID 및 구조화 로깅 도입
- 핵심 인증/토큰 회귀 테스트 보강

## 참고

- 백엔드 구현: [BE/app](BE/app)
- DB 스키마: [BE/docs/db/01_postgresql_schema.sql](BE/docs/db/01_postgresql_schema.sql)
- Docker 구성: [BE/docker](BE/docker)