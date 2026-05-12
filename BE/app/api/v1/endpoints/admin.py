from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id
from app.models import CommunityPost
from app.models import PaymentEvent
from app.models import Project
from app.models import Idea
from app.models import Report
from app.models import UserSubscription
from app.models import User
from app.services.economy import award_coins
from app.services.economy import send_stale_project_notifications

router = APIRouter()


class AdminCoinGrantRequest(BaseModel):
    amount: int = Field(gt=0)
    note: str | None = Field(default=None, max_length=500)


class AdminNoticeCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    content: str = Field(min_length=1)
    category: str = Field(default="announcement", pattern="^(announcement|event)$")
    is_pinned: bool = False


class AdminCoinRevokeRequest(BaseModel):
    amount: int = Field(gt=0)
    note: str | None = Field(default=None, max_length=500)


def _ensure_admin(db: Session, user_id: int) -> None:
    user = db.get(User, user_id)
    if user is None or user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin permission required")


@router.get("/overview", summary="관리자 운영 요약", description="관리자 대시보드에 필요한 핵심 운영 지표를 조회합니다.")
async def get_admin_overview(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    _ensure_admin(db, current_user_id)
    open_reports = db.query(Report).filter(Report.status == "open").count()
    pending_payments = db.query(PaymentEvent).filter(PaymentEvent.processed_at.is_(None)).count()
    return success_response(
        data={
            "users_total": db.query(User).count(),
            "users_active": db.query(User).filter(User.is_active.is_(True)).count(),
            "projects_total": db.query(Project).count(),
            "projects_active": db.query(Project).filter(Project.deleted_at.is_(None)).count(),
            "reports_open": open_reports,
            "reports_total": db.query(Report).count(),
            "payment_events_total": db.query(PaymentEvent).count(),
            "payment_events_pending": pending_payments,
            "subscriptions_active": db.query(UserSubscription).filter(UserSubscription.status == "active").count(),
        }
    )


@router.get("/users", summary="관리자 사용자 목록", description="관리자 권한으로 전체 사용자 목록을 조회합니다.")
async def list_users_for_admin(
    q: str | None = Query(default=None, description="이메일 또는 닉네임 검색어"),
    role: str | None = Query(default=None, description="필터할 역할"),
    is_active: bool | None = Query(default=None, description="활성 상태 필터"),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """관리자 사용자 목록 조회 API.

    Swagger 테스트 방법:
    - Authorization 헤더에 admin 계정 토큰을 넣습니다.

    권한:
    - admin 역할이 아니면 `403`
    """
    _ensure_admin(db, current_user_id)
    query = db.query(User)

    if q:
        search = f"%{q.strip()}%"
        query = query.filter(or_(User.email.ilike(search), User.nickname.ilike(search)))
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active.is_(is_active))

    users = query.order_by(User.id.desc()).all()
    return success_response(
        data=[
            {
                "id": u.id,
                "email": u.email,
                "nickname": u.nickname,
                "role": u.role,
                "is_active": u.is_active,
                "is_verified": u.is_verified,
                "coin_balance": u.coin_balance,
                "created_at": u.created_at,
            }
            for u in users
        ]
    )


@router.post("/users/{user_id}/coins", summary="관리자 코인 지급", description="관리자가 특정 사용자에게 코인을 지급합니다.")
async def grant_user_coins_for_admin(
    user_id: int,
    payload: AdminCoinGrantRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    _ensure_admin(db, current_user_id)
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    balance = award_coins(
        db,
        user_id=user_id,
        amount=payload.amount,
        event_type="admin.manual_grant",
        source_type="admin",
        source_id=int(datetime.now(timezone.utc).timestamp() * 1_000_000),
        note=payload.note or "Admin manual coin grant",
    )
    db.commit()
    return success_response(data={"id": user.id, "coin_balance": balance, "amount": payload.amount})


@router.patch("/users/{user_id}/status", summary="관리자 사용자 상태 변경", description="관리자 권한으로 사용자 활성 상태/역할을 수정합니다.")
async def update_user_status(
    user_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """관리자 사용자 상태 변경 API.

    Swagger 테스트 방법:
    - body에 `is_active`, `role` 중 필요한 필드를 전달합니다.

    권한/검증:
    - admin만 호출 가능
    - 대상 사용자가 없으면 `404`
    """
    _ensure_admin(db, current_user_id)
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if "is_active" in payload:
        user.is_active = bool(payload["is_active"])
    if "role" in payload:
        role = payload["role"]
        if role not in {"user", "leader", "admin"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")
        user.role = role
    db.commit()
    return success_response(data={"id": user.id, "is_active": user.is_active, "role": user.role})


@router.get("/projects", summary="관리자 프로젝트 목록", description="관리자 권한으로 프로젝트 목록을 조회합니다.")
async def list_projects_for_admin(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """관리자 프로젝트 목록 조회 API.

    Swagger 테스트 방법:
    - admin 계정으로 호출합니다.
    - 전체 프로젝트를 최신순으로 반환합니다.
    """
    _ensure_admin(db, current_user_id)
    projects = db.query(Project).order_by(Project.id.desc()).all()
    return success_response(
        data=[
            {
                "id": p.id,
                "title": p.title,
                "status": p.status,
                "leader_id": p.leader_id,
                "category": p.category,
                "difficulty": p.difficulty,
                "deleted_at": p.deleted_at,
                "created_at": p.created_at,
            }
            for p in projects
        ]
    )


@router.get("/reports", summary="관리자 신고 목록", description="신고 목록을 조회해 모더레이션 대상을 확인합니다.")
async def list_reports_for_admin(
    scope: str | None = Query(default=None, description="user/project/post/chat/all 중 하나"),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """관리자 신고 목록 조회 API.

    Swagger 테스트 방법:
    - admin 계정으로 호출합니다.
    - 신고 상태와 사유를 포함해 최신순으로 반환합니다.
    """
    _ensure_admin(db, current_user_id)
    query = db.query(Report)

    if scope and scope != "all":
        if scope == "user":
            query = query.filter(Report.target_user_id.isnot(None))
        elif scope == "project":
            query = query.filter(Report.target_project_id.isnot(None))
        elif scope == "post":
            query = query.filter(Report.target_post_id.isnot(None))
        elif scope == "chat":
            query = query.filter(Report.target_chat_room_id.isnot(None))
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid scope")

    reports = query.order_by(Report.id.desc()).all()
    return success_response(
        data=[
            {
                "id": r.id,
                "reporter_id": r.reporter_id,
                "target_user_id": r.target_user_id,
                "target_project_id": r.target_project_id,
                "target_post_id": r.target_post_id,
                "target_chat_room_id": r.target_chat_room_id,
                "target_scope": (
                    "chat"
                    if r.target_chat_room_id is not None
                    else "post"
                    if r.target_post_id is not None
                    else "project"
                    if r.target_project_id is not None
                    else "user"
                    if r.target_user_id is not None
                    else "unknown"
                ),
                "status": r.status,
                "reason": r.reason,
                "handled_by": r.handled_by,
                "handled_at": r.handled_at,
            }
            for r in reports
        ]
    )


@router.post("/notices", summary="관리자 공지 작성", description="공지 게시물을 작성합니다.")
async def create_notice_for_admin(
    payload: AdminNoticeCreateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    _ensure_admin(db, current_user_id)

    post = CommunityPost(
        author_id=current_user_id,
        title=payload.title,
        content=payload.content,
        category=payload.category or "announcement",
        is_pinned=payload.is_pinned,
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    return success_response(
        data={
            "id": post.id,
            "title": post.title,
            "content": post.content,
            "category": post.category,
            "is_pinned": post.is_pinned,
            "created_at": post.created_at,
        }
    )


@router.post("/users/{user_id}/coins/revoke", summary="관리자 코인 환수", description="관리자가 특정 사용자로부터 코인을 환수합니다.")
async def revoke_user_coins_for_admin(
    user_id: int,
    payload: AdminCoinRevokeRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    _ensure_admin(db, current_user_id)
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # perform revoke: create negative coin transaction
    amount = int(payload.amount)
    user.coin_balance = int(user.coin_balance or 0) - amount
    from app.models import CoinTransaction

    transaction = CoinTransaction(
        user_id=user_id,
        amount=-amount,
        balance_after=user.coin_balance,
        event_type="admin.manual_revoke",
        source_type="admin",
        source_id=int(datetime.now(timezone.utc).timestamp() * 1_000_000),
        note=payload.note or "Admin manual coin revoke",
    )
    db.add(transaction)
    db.commit()
    return success_response(data={"id": user.id, "coin_balance": user.coin_balance, "revoked": amount})


@router.get("/posts/mine", summary="관리자 작성 공지/이벤트 목록", description="현재 admin이 작성한 공지와 이벤트 글을 조회합니다.")
async def list_my_admin_posts(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    _ensure_admin(db, current_user_id)
    posts = (
        db.query(CommunityPost)
        .filter(CommunityPost.author_id == current_user_id, CommunityPost.category.in_(["announcement", "event"]))
        .order_by(CommunityPost.created_at.desc())
        .all()
    )
    return success_response(
        data=[
            {
                "id": p.id,
                "title": p.title,
                "category": p.category,
                "is_pinned": p.is_pinned,
                "created_at": p.created_at,
                "updated_at": p.updated_at,
            }
            for p in posts
        ]
    )


@router.patch("/posts/{post_id}", summary="관리자 게시물 수정", description="관리자가 특정 게시물을 수정합니다.")
async def admin_update_post(
    post_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    _ensure_admin(db, current_user_id)
    post = db.get(CommunityPost, post_id)
    if post is None or post.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    # allow updating title/content/category/is_pinned
    if "title" in payload:
        post.title = payload["title"]
    if "content" in payload:
        post.content = payload["content"]
    if "category" in payload:
        post.category = payload["category"]
    if "is_pinned" in payload:
        post.is_pinned = bool(payload["is_pinned"])
    db.commit()
    db.refresh(post)
    return success_response(data={"id": post.id, "updated": True})


@router.delete("/posts/{post_id}", summary="관리자 게시물 삭제", description="관리자가 특정 게시물을 강제로 삭제합니다 (soft delete).")
async def admin_delete_post(
    post_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    _ensure_admin(db, current_user_id)
    post = db.get(CommunityPost, post_id)
    if post is None or post.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    post.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return success_response(data={"deleted": True, "post_id": post_id})


@router.patch("/reports/{report_id}", summary="관리자 신고 처리", description="신고 상태를 변경하고 처리자를 기록합니다.")
async def process_report(
    report_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """관리자 신고 처리 API.

    Swagger 테스트 방법:
    - body 예시: `{ "status": "resolved" }`
    - 처리자(`handled_by`)와 처리시각(`handled_at`)을 자동 기록합니다.

    검증:
    - 신고가 없으면 `404`
    """
    _ensure_admin(db, current_user_id)
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    if payload.get("status"):
        report.status = payload["status"]
    report.handled_by = current_user_id
    report.handled_at = datetime.now(timezone.utc)
    db.commit()
    return success_response(data={"id": report.id, "status": report.status})


@router.get("/payments", summary="관리자 결제 이벤트 목록", description="결제 웹훅/수동 결제 이벤트를 최신순으로 조회합니다.")
async def list_payment_events_for_admin(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    _ensure_admin(db, current_user_id)
    events = db.query(PaymentEvent).order_by(PaymentEvent.id.desc()).all()
    return success_response(
        data=[
            {
                "id": event.id,
                "user_subscription_id": event.user_subscription_id,
                "provider": event.provider,
                "provider_event_id": event.provider_event_id,
                "event_type": event.event_type,
                "payload": event.payload,
                "processed_at": event.processed_at,
            }
            for event in events
        ]
    )


@router.patch("/payments/{event_id}", summary="관리자 결제 이벤트 처리", description="결제 이벤트의 처리 시각을 기록하거나 해제합니다.")
async def update_payment_event_for_admin(
    event_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    _ensure_admin(db, current_user_id)
    event = db.get(PaymentEvent, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment event not found")

    if payload.get("processed") is False:
        event.processed_at = None
    else:
        event.processed_at = datetime.now(timezone.utc)
    db.commit()
    return success_response(data={"id": event.id, "processed_at": event.processed_at})


@router.post("/projects/stale-reminders/run", summary="미진행 프로젝트 알림 배치 실행", description="30일 이상 시작되지 않은 프로젝트에 알림을 생성합니다.")
async def run_stale_project_reminders(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    _ensure_admin(db, current_user_id)
    created_count = send_stale_project_notifications(db, stale_days=30)
    db.commit()
    return success_response(data={"created_notifications": created_count})


@router.post("/posts/{post_id}/takedown", summary="관리자 게시물 강제 내리기", description="관리자가 특정 게시물을 강제로 내립니다 (soft delete).")
async def admin_takedown_post(
    post_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    _ensure_admin(db, current_user_id)
    post = db.get(CommunityPost, post_id)
    if post is None or post.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    post.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return success_response(data={"deleted": True, "post_id": post_id})


@router.post("/ideas/{idea_id}/takedown", summary="관리자 아이디어 강제 내리기", description="관리자가 특정 아이디어를 강제로 내립니다 (soft delete).")
async def admin_takedown_idea(
    idea_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    _ensure_admin(db, current_user_id)
    idea = db.get(Idea, idea_id)
    if idea is None or idea.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found")
    idea.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return success_response(data={"deleted": True, "idea_id": idea_id})


@router.post("/projects/{project_id}/takedown", summary="관리자 프로젝트 강제 내리기", description="관리자가 특정 프로젝트를 강제로 내립니다 (soft delete).")
async def admin_takedown_project(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    _ensure_admin(db, current_user_id)
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    project.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return success_response(data={"deleted": True, "project_id": project_id})
