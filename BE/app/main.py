from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from prometheus_fastapi_instrumentator import Instrumentator  # pyright: ignore[reportMissingImports]
except Exception:  # pragma: no cover - optional dependency during local setup
    Instrumentator = None

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.models import entities  # noqa: F401


OPENAPI_TAGS = [
    {
        "name": "auth",
        "description": "회원가입/로그인/JWT 재발급/OAuth(GitHub, Google) 및 OAuth 계정 연결·해제 API입니다.",
    },
    {
        "name": "users",
        "description": "프로필, 기술 스택, 활동 통계, 신뢰도(리뷰 기반 집계) 조회 API입니다.",
    },
    {
        "name": "ideas",
        "description": "아이디어 CRUD, 기술 스택/해시태그, 좋아요, 북마크 기능을 제공합니다.",
    },
    {
        "name": "projects",
        "description": "프로젝트 생성/수정/상태관리, 지원·초대·멤버관리, Todo/회고/리뷰/실패경험을 다룹니다.",
    },
    {
        "name": "matching",
        "description": "프로젝트와 사용자 매칭을 위한 추천 API입니다.",
    },
    {
        "name": "adoptions",
        "description": "프로젝트 이어받기 요청 생성 및 리더 승인/거절 처리 API입니다.",
    },
    {
        "name": "reviews",
        "description": "프로젝트 리뷰 작성 및 사용자 평점 집계 조회 API입니다.",
    },
    {
        "name": "search",
        "description": "프로젝트/아이디어/사용자 검색과 태그 자동완성 API입니다.",
    },
    {
        "name": "subscriptions",
        "description": "구독 플랜 조회, 구독 생성/해지, 결제 이벤트 웹훅 API입니다.",
    },
    {
        "name": "recommendations",
        "description": "프로젝트/팀원 추천 및 추천 사유 설명 API입니다.",
    },
    {
        "name": "chats",
        "description": "프로젝트 채팅방 생성/조회와 메시지 송수신 API입니다.",
    },
    {
        "name": "notifications",
        "description": "사용자 알림 목록 조회 및 읽음 처리 API입니다.",
    },
    {
        "name": "admin",
        "description": "관리자 전용 사용자/프로젝트/신고 모더레이션 API입니다.",
    },
    {
        "name": "health",
        "description": "서비스 상태 확인용 헬스체크 API입니다.",
    },
]


def create_app() -> FastAPI:
    Base.metadata.create_all(bind=engine)

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Devory Backend API입니다.\\n\\n"
            "- Base URL: /api/v1\\n"
            "- Auth: Bearer JWT(access/refresh)\\n"
            "- OAuth: GitHub, Google authorization code flow\\n"
            "- Data Store: PostgreSQL + Redis(token revoke store)\\n\\n"
            "엔드포인트별 상세 동작은 API Catalog 문서를 함께 참고하세요: "
            "BE/app/api/API_CATALOG.md"
        ),
        openapi_tags=OPENAPI_TAGS,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    @app.get("/health", tags=["health"])
    async def health_check() -> dict:
        return {"status": "ok"}

    app.include_router(api_router, prefix="/api/v1")

    allowed_origins = [
        origin.strip()
        for origin in [settings.frontend_origin, "http://localhost:3000", "http://127.0.0.1:3000"]
        if origin
    ]
    if allowed_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=allowed_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Expose Prometheus metrics at /metrics for runtime monitoring.
    if Instrumentator is not None:
        Instrumentator(
            should_group_status_codes=True,
            should_ignore_untemplated=True,
            excluded_handlers=["/metrics", "/docs", "/redoc", "/openapi.json"],
        ).instrument(app).expose(app, include_in_schema=False, should_gzip=True)

    return app


app = create_app()
