# FastAPI 완전 학습 가이드 (기초 문법 -> 실전 구현)

이 문서는 FastAPI를 처음 배우는 사람도 Devory 백엔드를 구현할 수 있도록, 기초 문법부터 프로젝트 구조, 인증, DB, 테스트, 배포까지 한 번에 학습하도록 구성한 통합 자료다.

---

## 1. FastAPI 한눈에 이해하기

### 1.1 FastAPI란?
- Python 타입 힌트를 활용해 API를 빠르고 안전하게 개발하는 웹 프레임워크
- 자동 문서화(Swagger UI, ReDoc) 기본 제공
- 비동기(Async) 처리와 높은 성능을 지원
- Pydantic 기반으로 요청/응답 검증 자동화

### 1.2 FastAPI의 핵심 장점
- 개발 생산성: 선언형 문법으로 라우트/검증/문서가 동시에 생성
- 안정성: 입력 검증과 타입 체크로 런타임 오류 감소
- 확장성: 라우터 분리, 의존성 주입, 미들웨어로 대규모 구조 가능

### 1.3 FastAPI 동작 개념
- 클라이언트 -> Uvicorn(ASGI 서버) -> FastAPI 앱 -> 라우터 -> 서비스/DB -> 응답
- 비동기 함수(`async def`)는 I/O 대기 시간을 효율적으로 처리

---

## 2. 필수 Python 문법(타입 힌트 중심)

FastAPI는 타입 힌트가 문법의 일부처럼 작동한다.

```python
from typing import Optional, List

name: str = "devory"
age: int = 20
score: Optional[float] = None
tags: List[str] = ["fastapi", "python"]
```

핵심 포인트:
- `str`, `int`, `bool` 등 기본 타입
- `Optional[T]` 또는 `T | None`
- `list[str]`, `dict[str, int]` 같은 제네릭 타입
- 함수 파라미터 타입이 곧 API 입력 규칙이 됨

---

## 3. FastAPI 프로젝트 시작하기

### 3.1 최소 실행 코드

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root() -> dict:
    return {"message": "Hello FastAPI"}
```

실행:
```bash
uvicorn main:app --reload
```

확인 URL:
- API: `http://127.0.0.1:8000/`
- Swagger: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

### 3.2 현재 Devory 구조와 연결
현재 프로젝트에서는 루트 엔트리에서 앱을 가져오도록 구성했다.
- `BE/main.py` -> `app.main`의 `app`을 import
- `BE/app/main.py` -> `create_app()`에서 라우터 등록

---

## 4. 라우팅 기본 문법

### 4.1 HTTP 메서드
- `@router.get(...)`
- `@router.post(...)`
- `@router.patch(...)`
- `@router.delete(...)`

```python
from fastapi import APIRouter

router = APIRouter()

@router.get("/items")
async def list_items() -> dict:
    return {"items": []}

@router.post("/items")
async def create_item() -> dict:
    return {"message": "created"}
```

### 4.2 Path Parameter
```python
@router.get("/items/{item_id}")
async def get_item(item_id: int) -> dict:
    return {"item_id": item_id}
```

### 4.3 Query Parameter
```python
@router.get("/search")
async def search(q: str, page: int = 1, size: int = 20) -> dict:
    return {"q": q, "page": page, "size": size}
```

### 4.4 Body Parameter
```python
from pydantic import BaseModel

class ItemCreate(BaseModel):
    name: str
    price: float

@router.post("/items")
async def create_item(payload: ItemCreate) -> dict:
    return {"name": payload.name, "price": payload.price}
```

---

## 5. Pydantic 모델(요청/응답 검증)

### 5.1 요청 모델 / 응답 모델 분리
```python
from pydantic import BaseModel, Field

class UserCreate(BaseModel):
    email: str
    password: str = Field(min_length=8)

class UserResponse(BaseModel):
    id: int
    email: str
```

### 5.2 response_model 사용
```python
@router.post("/users", response_model=UserResponse)
async def create_user(payload: UserCreate) -> UserResponse:
    return UserResponse(id=1, email=payload.email)
```

### 5.3 자주 쓰는 Field 옵션
- `min_length`, `max_length`
- `gt`, `ge`, `lt`, `le`
- `description`, `examples`

```python
class ProjectCreate(BaseModel):
    title: str = Field(min_length=3, max_length=100)
    difficulty: str = Field(description="easy | medium | hard")
    recruit_count: int = Field(ge=1, le=20)
```

---

## 6. 요청 입력 세부 문법

### 6.1 Path, Query, Header 명시
```python
from fastapi import Query, Path, Header

@router.get("/projects/{project_id}")
async def get_project(
    project_id: int = Path(ge=1),
    lang: str = Query(default="ko"),
    request_id: str | None = Header(default=None),
) -> dict:
    return {"project_id": project_id, "lang": lang, "request_id": request_id}
```

### 6.2 Form / File 업로드
```python
from fastapi import File, UploadFile, Form

@router.post("/upload")
async def upload_file(title: str = Form(...), file: UploadFile = File(...)) -> dict:
    return {"title": title, "filename": file.filename}
```

---

## 7. 응답 처리

### 7.1 상태 코드 지정
```python
from fastapi import status

@router.post("/ideas", status_code=status.HTTP_201_CREATED)
async def create_idea() -> dict:
    return {"message": "created"}
```

### 7.2 Response 객체 직접 사용
```python
from fastapi.responses import JSONResponse

@router.get("/ping")
async def ping() -> JSONResponse:
    return JSONResponse(status_code=200, content={"pong": True})
```

### 7.3 공통 응답 포맷 권장
Devory API Plan의 공통 형식을 유지하면 프론트/백엔드 협업이 쉬워진다.

```json
{
  "success": true,
  "data": {"id": 1},
  "meta": {"page": 1, "size": 20}
}
```

---

## 8. 예외 처리와 검증 에러

### 8.1 HTTPException
```python
from fastapi import HTTPException

@router.get("/users/{user_id}")
async def get_user(user_id: int) -> dict:
    if user_id < 1:
        raise HTTPException(status_code=400, detail="Invalid user_id")
    return {"user_id": user_id}
```

### 8.2 커스텀 예외 핸들러
```python
from fastapi import Request
from fastapi.responses import JSONResponse

class DomainException(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message

@app.exception_handler(DomainException)
async def handle_domain_exception(request: Request, exc: DomainException):
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "error": {"code": exc.code, "message": exc.message, "details": None},
        },
    )
```

---

## 9. 의존성 주입(Dependency Injection)

FastAPI의 강력한 기능이다. 인증, DB 세션, 권한 검사 등을 재사용할 수 있다.

```python
from fastapi import Depends

async def get_current_user() -> dict:
    return {"id": 1, "role": "user"}

@router.get("/me")
async def me(user: dict = Depends(get_current_user)) -> dict:
    return user
```

권장 사용처:
- JWT 토큰 검증
- DB 세션 생성/종료
- 리더 권한 검사(`role == leader`)

---

## 10. 라우터 분리와 앱 조립

### 10.1 도메인 라우터 분리
- auth, users, ideas, projects 등 파일을 나누어 관리
- 각 파일은 `router = APIRouter()` 선언

### 10.2 중앙 router에서 include
```python
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
```

### 10.3 메인 앱에서 버전 Prefix
```python
app.include_router(api_router, prefix="/api/v1")
```

---

## 11. 설정 관리(.env)

`pydantic-settings`로 환경변수를 타입 안전하게 관리한다.

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "Devory API"
    database_url: str
    jwt_secret_key: str

    class Config:
        env_file = ".env"
```

`.env` 예시:
```env
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/devory
JWT_SECRET_KEY=change_me
```

---

## 12. 인증/인가 기본 패턴 (JWT)

### 12.1 개념
- Access Token: 짧은 만료
- Refresh Token: 재발급용
- Authorization 헤더의 Bearer 토큰 사용

### 12.2 일반 구현 흐름
1. 로그인 성공 시 Access/Refresh 발급
2. 보호 API에서 Access 검증
3. Access 만료 시 Refresh로 재발급

### 12.3 역할 기반 권한(RBAC)
- `guest`, `user`, `leader`, `admin`
- 예: 프로젝트 지원자 조회는 리더/관리자만 가능

---

## 13. 데이터베이스 연동(SQLAlchemy)

### 13.1 기본 레이어 구조
- models: ORM 모델
- repositories: DB 접근 쿼리
- services: 비즈니스 규칙
- endpoints: HTTP 인터페이스

### 13.2 세션 개념
- 요청 시작 시 세션 획득
- 요청 종료 시 세션 반환/종료

### 13.3 예시 흐름
엔드포인트 -> 서비스 -> 리포지토리 -> DB

이렇게 분리하면 테스트가 쉬워지고 비즈니스 로직이 HTTP 코드와 분리된다.

---

## 14. 마이그레이션(Alembic)

일반 흐름:
1. 모델 변경
2. 마이그레이션 생성
3. 마이그레이션 적용

예시 명령:
```bash
alembic revision --autogenerate -m "create users table"
alembic upgrade head
```

주의:
- 운영 배포 전 스키마 변경 리뷰 필수
- 데이터 손실 가능 변경(drop/rename)은 수동 검토

---

## 15. 미들웨어와 공통 기능

### 15.1 CORS
프론트 도메인에서 API를 호출할 때 필요.

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 15.2 로깅 미들웨어
- 요청 시간, 경로, 상태코드, request_id 기록
- 장애 분석과 성능 개선의 핵심

---

## 16. 비동기(Async) 정확히 이해하기

### 16.1 언제 async를 쓰나?
- DB/HTTP 호출처럼 I/O 대기가 있는 작업
- 외부 API 호출(LLM, 결제사, OAuth)에서 이점 큼

### 16.2 CPU 바운드 작업 주의
- 이미지 처리, 대규모 연산은 async만으로 빨라지지 않음
- 별도 워커(Celery, RQ, Dramatiq 등) 고려

---

## 17. 백그라운드 작업

```python
from fastapi import BackgroundTasks

def send_email(to: str) -> None:
    pass

@router.post("/auth/password/forgot")
async def forgot_password(email: str, tasks: BackgroundTasks) -> dict:
    tasks.add_task(send_email, email)
    return {"message": "메일 발송 요청 완료"}
```

활용 예:
- 비밀번호 재설정 메일
- 알림 생성
- 로그/감사 이벤트 비동기 기록

---

## 18. WebSocket 기초(채팅 기능 대비)

```python
from fastapi import WebSocket

@app.websocket("/ws/chat/{room_id}")
async def chat_socket(websocket: WebSocket, room_id: int):
    await websocket.accept()
    while True:
        message = await websocket.receive_text()
        await websocket.send_text(f"room={room_id}, echo={message}")
```

Devory에서는 채팅 기능을 REST + WebSocket 혼합 구조로 설계하면 안정적이다.

---

## 19. 테스트(필수)

### 19.1 TestClient 기본
```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
```

### 19.2 테스트 전략
- Unit Test: 서비스 로직 검증
- Integration Test: API + DB 흐름 검증
- 최소 목표: 핵심 인증/권한/프로젝트 생성 흐름

### 19.3 우선 테스트 대상
1. 로그인/토큰 재발급
2. 프로젝트 생성/수정/삭제 권한
3. 지원 승인/거절 권한
4. 리뷰 작성 조건(프로젝트 종료 여부)

---

## 20. 문서화 전략

Swagger 자동 문서 외에, 팀 협업을 위해 다음을 병행한다.
- API_PLAN.md: 기능 단위 목록
- 학습 문서(본 문서): 구현 원리/문법
- 엔드포인트 docstring: 요청/응답/권한 규칙 명시

추천 규칙:
- 모든 엔드포인트에 목적, 권한, 실패 케이스 문서화
- 400/401/403/404/409/422 에러 케이스 정의

---

## 21. 보안 체크리스트

- 비밀번호 해시 저장(평문 저장 금지)
- JWT Secret 외부 유출 방지
- SQL 인젝션 방지(ORM/파라미터 바인딩)
- Rate Limit 적용(auth, recommendation)
- 결제 웹훅 서명 검증
- 개인정보 최소 수집/마스킹 로그

---

## 22. 성능/운영 체크리스트

- Pagination 기본 적용(`page`, `size`)
- N+1 쿼리 점검
- 인덱스 설계(email, project status, created_at)
- 타임아웃과 재시도 전략
- 구조화 로그 + 모니터링
- readiness/liveness 헬스체크 분리

---

## 23. Devory API Plan과 구현 매핑

### 23.1 구현 우선순위(MVP)
1. Auth + Users
2. Ideas + Projects + Applications
3. Todo + Retrospective + Reviews
4. Search
5. Subscription
6. Recommendation + Adoption + Failure Story

### 23.2 파일 매핑 원칙
- 인증: `app/api/v1/endpoints/auth.py`
- 사용자: `app/api/v1/endpoints/users.py`
- 프로젝트/지원/할일: `app/api/v1/endpoints/projects.py`
- 나머지 도메인별 endpoint 파일에 단계적으로 추가

---

## 24. 구현 시 자주 하는 실수

- 요청 모델과 응답 모델을 같은 모델로 재사용
- 비즈니스 로직을 endpoint 함수에 과도하게 작성
- 트랜잭션 경계를 endpoint에 흩뿌림
- 예외 포맷이 엔드포인트마다 다름
- 권한 검사를 일부 API에서 누락

해결 원칙:
- 모델 분리(Create/Update/Response)
- Service 계층에 규칙 집중
- 공통 예외 핸들러 + 공통 응답 스키마
- 권한 의존성 함수 재사용

---

## 25. 실전 구현 로드맵(추천)

### Step 1
- User, Project, Application ORM 모델 작성
- DB 세션/기본 마이그레이션 구축

### Step 2
- 회원가입/로그인/JWT 재발급 구현
- 인증 의존성(`get_current_user`) 작성

### Step 3
- 프로젝트 생성/조회/수정/삭제 + 권한
- 프로젝트 지원/승인/거절 구현

### Step 4
- Todo, 회고, 리뷰 구현
- 검색/필터/정렬/페이지네이션 추가

### Step 5
- 구독 결제, 추천, 채팅, 알림 확장
- 테스트와 모니터링 강화

---

## 26. 빠른 문법 치트시트

### 라우터 선언
```python
router = APIRouter(prefix="/users", tags=["users"])
```

### Path + Query
```python
@router.get("/{user_id}")
async def get_user(user_id: int, detail: bool = False):
    ...
```

### Body 모델
```python
class Payload(BaseModel):
    name: str
```

### 의존성 주입
```python
async def endpoint(user=Depends(get_current_user)):
    ...
```

### 예외
```python
raise HTTPException(status_code=404, detail="Not found")
```

---

## 27. 마무리

이 문서를 기준으로 학습하면, FastAPI 기본 문법 학습에서 끝나지 않고 실제 Devory 백엔드를 단계적으로 구현할 수 있다.

다음 액션 추천:
1. health + auth/signup + auth/login부터 실제 동작 구현
2. User/Project/Application 모델과 마이그레이션 작성
3. pytest로 인증/권한 테스트를 먼저 고정
