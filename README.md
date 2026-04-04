# Devory / Next Contest

프로젝트 협업과 팀 기반 개발 경험을 관리하기 위한 백엔드 서비스입니다.
FastAPI, PostgreSQL, Redis, SQLAlchemy를 기반으로 인증, 프로젝트 관리, 팀 매칭, 후기, 알림, 채팅, 구독 기능을 제공합니다.

## 개요

이 저장소는 Devory 백엔드와 로컬 개발 인프라를 포함합니다.
API는 FastAPI로 구성되어 있으며, PostgreSQL을 기본 데이터베이스로 사용하고 Redis를 토큰 revoke 및 임시 토큰 저장소로 사용합니다.

Swagger 문서를 통해 대부분의 API를 바로 테스트할 수 있도록 설계되어 있습니다.

## 주요 기능

- 회원가입, 로그인, 로그아웃, 비밀번호 재설정
- OAuth 실서비스 로그인(GitHub/Google authorization code flow)
- 기존 계정 OAuth 연결/해제(GitHub/Google)
- Access / Refresh 토큰 관리 및 로그아웃 시 토큰 무효화
- 아이디어 등록, 수정, 좋아요, 북마크
- 프로젝트 생성, 참여 신청, 초대, 멤버 관리
- 마일스톤, 투두, 회고, 실패 경험 기록
- 리뷰 및 평점 집계
- 팀/프로젝트 추천 및 검색
- 구독 플랜, 결제 이벤트, 알림, 채팅, 신고, 관리자 기능

## 기술 스택

- Backend: FastAPI
- ORM: SQLAlchemy
- DB: PostgreSQL
- Cache / Token Store: Redis
- Validation: Pydantic
- Auth: JWT-style token flow
- Container: Docker, Docker Compose

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
│   ├── docs/
│   ├── migrations/
│   ├── requirements.txt
│   └── main.py
├── README.md
└── idea/
```

## 핵심 문서

- [BE/docs/API_PLAN.md](BE/docs/API_PLAN.md): API 설계 초안
- [BE/app/api/API_CATALOG.md](BE/app/api/API_CATALOG.md): API 동작 총정리 카탈로그
- [BE/docs/SWAGGER_TEST_GUIDE.md](BE/docs/SWAGGER_TEST_GUIDE.md): Swagger 테스트 시나리오
- [BE/docs/db/DOCKER_POSTGRES_GUIDE.md](BE/docs/db/DOCKER_POSTGRES_GUIDE.md): PostgreSQL Docker 실행 가이드
- [BE/docs/db/README.md](BE/docs/db/README.md): DB 스키마 적용 순서 및 설계 원칙
- [BE/docs/db/REDIS_GUIDE.md](BE/docs/db/REDIS_GUIDE.md): Redis 사용 가이드
- [BE/docker/README.md](BE/docker/README.md): Docker 실행 개요

## 로컬 실행 방법

### 1. 환경 파일 준비

```bash
cd BE
cp .env.example .env
```

### 2. 의존성 설치

```bash
cd BE
pip install -r requirements.txt
```

### 3. 서버 실행

```bash
cd BE
uvicorn app.main:app --reload
```

실행 후 아래 주소에서 확인할 수 있습니다.

- API: http://127.0.0.1:8000
- Swagger: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc

## Docker 실행 방법

Docker Compose는 PostgreSQL, Redis, API를 함께 올립니다.

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
```

중지 및 초기화:

```bash
docker compose down -v
```

## 환경 변수

기본적으로 다음 값을 사용합니다.

```env
DATABASE_URL=postgresql+psycopg2://devory:devory1234@127.0.0.1:5432/devory
REDIS_URL=redis://127.0.0.1:6379/0
JWT_SECRET_KEY=change-this-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
GITHUB_OAUTH_REDIRECT_URI=http://127.0.0.1:3000/auth/github/callback
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:3000/auth/google/callback
```

Docker Compose를 사용할 때는 보통 아래처럼 바뀝니다.

```env
DATABASE_URL=postgresql+psycopg2://devory:devory1234@db:5432/devory
REDIS_URL=redis://redis:6379/0
```

OAuth redirect URI는 프론트엔드의 실제 callback URL과 반드시 일치해야 합니다.

## 데이터베이스 운영 방식

- DB 초기 스키마는 [BE/docs/db/01_postgresql_schema.sql](BE/docs/db/01_postgresql_schema.sql) 단일 파일 기준으로 관리합니다.
- 로컬 재초기화가 필요하면 아래 명령으로 볼륨까지 정리 후 재기동합니다.

```bash
cd BE/docker
docker compose down -v --remove-orphans
docker compose up -d
```

## Swagger 테스트 순서

1. 회원가입
2. 로그인
3. 응답에서 access token / refresh token 확인
4. Swagger의 Authorize 또는 요청 헤더에 `Bearer <access_token>` 입력
5. 사용자, 아이디어, 프로젝트, 채팅, 알림 API를 순서대로 테스트

자세한 테스트 예시는 [BE/docs/SWAGGER_TEST_GUIDE.md](BE/docs/SWAGGER_TEST_GUIDE.md)를 참고하세요.

## OAuth 계정 연결/해제

- 연결 상태 조회: GET /api/v1/auth/oauth/links
- GitHub 연결: POST /api/v1/auth/oauth/link/github
- Google 연결: POST /api/v1/auth/oauth/link/google
- GitHub 해제: DELETE /api/v1/auth/oauth/unlink/github
- Google 해제: DELETE /api/v1/auth/oauth/unlink/google

연결 해제 시 마지막 로그인 수단만 남아 있으면 안전을 위해 해제가 차단됩니다.

## 인증 정책

- Access token은 Bearer 토큰 방식으로 검증합니다.
- Logout 시 access token과 refresh token을 revoke 처리합니다.
- Redis를 사용해 revoke 상태와 임시 토큰을 저장합니다.
- 서버 재시작 후에도 revoke 상태를 유지할 수 있습니다.

## 개발 규칙

개발 규칙은 요약만 유지하고, 상세 기준은 아래 문서를 기준으로 운영합니다.

- 요약 흐름: `main -> develop -> feature/[본인 포지션]`
- 작업 브랜치: `feature/[본인 포지션]`
- 머지 흐름: `feature/[본인 포지션] -> develop` (PR)
- 상세 규칙 문서: [Working_Rule.md](Working_Rule.md)

## 현재 상태 정리

- 인증: email/닉네임 + 비밀번호 로그인, GitHub/Google OAuth 로그인, OAuth 연결/해제까지 구현 완료
- 토큰 정책: 로그아웃 시 access/refresh revoke 처리, Redis 기반 revoke 상태 저장 적용
- API 문서: Swagger 주석 대폭 보강, API 카탈로그 문서 추가
- 인프라: PostgreSQL + Redis + API Docker Compose 구성 완료
- DB 운영: `01_postgresql_schema.sql` 단일 파일 기준으로 스키마 관리

## BE 개발자 TODO

### 1) 인프라/운영

- [ ] 프로덕션 환경에 맞는 `.env` 실값 확정 (OAuth, DB, Redis, JWT)
- [ ] Docker Compose를 dev/prod로 분리하거나 운영용 compose override 정리
- [ ] 헬스체크 확장 (`/health`에 DB/Redis 연결 상태 포함)

### 2) 인증/보안

- [ ] OAuth state/PKCE 검증 로직 추가
- [ ] 비밀번호 해시를 sha256에서 `bcrypt` 또는 `argon2`로 전환
- [ ] OAuth 계정 연결/해제 이벤트 감사 로그(누가/언제/어떤 provider) 저장

### 3) 데이터/마이그레이션

- [ ] Alembic 기반 정식 마이그레이션 체계 도입
- [ ] 초기 데이터(seed) 스크립트 작성 (구독 플랜, 기본 스킬)
- [ ] DB 인덱스 점검 및 주요 쿼리 실행계획 확인

### 4) API 품질

- [ ] dict body를 쓰는 엔드포인트를 Pydantic 스키마로 치환
- [ ] 공통 에러 코드/메시지 규약 문서화
- [ ] OpenAPI examples를 요청/응답별로 추가해 Swagger 가독성 강화

### 5) 테스트

- [ ] 인증(Auth/OAuth) 통합 테스트 추가
- [ ] 프로젝트 핵심 플로우(E2E: 생성→지원→승인→리뷰) 테스트 작성
- [ ] 토큰 revoke/refresh 정책 회귀 테스트 작성

### 6) 관측성

- [ ] 구조화 로깅(JSON) 적용
- [ ] 요청 추적 ID(Request ID) 및 예외 로깅 표준화
- [ ] 주요 도메인 이벤트(가입/리뷰/구독) 메트릭 수집 포인트 추가

## 참고

- 백엔드의 실제 구현은 [BE/app](BE/app) 아래에 있습니다.
- 데이터베이스 구조는 [BE/docs/db/01_postgresql_schema.sql](BE/docs/db/01_postgresql_schema.sql)에서 확인할 수 있습니다.
- Docker 관련 파일은 [BE/docker](BE/docker)에 모아두었습니다.