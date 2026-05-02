from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id
from app.models import Project
from app.models import Report
from app.models import User

router = APIRouter()


def _ensure_admin(db: Session, user_id: int) -> None:
    user = db.get(User, user_id)
    if user is None or user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin permission required")


@router.get("/users", summary="관리자 사용자 목록", description="관리자 권한으로 전체 사용자 목록을 조회합니다.")
async def list_users_for_admin(
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
    users = db.query(User).order_by(User.id.desc()).all()
    return success_response(data=[{"id": u.id, "email": u.email, "nickname": u.nickname, "role": u.role, "is_active": u.is_active} for u in users])


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
        user.role = payload["role"]
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
    return success_response(data=[{"id": p.id, "title": p.title, "status": p.status, "leader_id": p.leader_id} for p in projects])


@router.get("/reports", summary="관리자 신고 목록", description="신고 목록을 조회해 모더레이션 대상을 확인합니다.")
async def list_reports_for_admin(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """관리자 신고 목록 조회 API.

    Swagger 테스트 방법:
    - admin 계정으로 호출합니다.
    - 신고 상태와 사유를 포함해 최신순으로 반환합니다.
    """
    _ensure_admin(db, current_user_id)
    reports = db.query(Report).order_by(Report.id.desc()).all()
    return success_response(data=[{"id": r.id, "reporter_id": r.reporter_id, "status": r.status, "reason": r.reason} for r in reports])


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
