from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id
from app.models import Application
from app.models import FailureStory
from app.models import Invitation
from app.models import Project
from app.models import ProjectMember
from app.models import ProjectMilestone
from app.models import ProjectRecruitment
from app.models import Retrospective
from app.models import Review
from app.models import Todo
from app.models import UserRatingAggregate
from app.schemas import ApplicationCreateRequest
from app.schemas import ApplicationDecisionRequest
from app.schemas import MilestoneCreateRequest
from app.schemas import MilestoneUpdateRequest
from app.schemas import ProjectCreateRequest
from app.schemas import ProjectStatusUpdateRequest
from app.schemas import ProjectUpdateRequest
from app.schemas import TodoCreateRequest
from app.schemas import TodoUpdateRequest

router = APIRouter()


def _get_project_or_404(db: Session, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _ensure_project_leader(project: Project, user_id: int) -> None:
    if project.leader_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Leader permission required")


def _ensure_project_member(db: Session, project_id: int, user_id: int) -> None:
    exists = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
            ProjectMember.left_at.is_(None),
        )
        .first()
    )
    if exists is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project member permission required")


@router.post("", summary="프로젝트 생성", description="새 프로젝트를 생성하고 생성자를 리더 멤버로 등록합니다.")
async def create_project(
    payload: ProjectCreateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 생성 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정하고 ProjectCreateRequest body를 전달합니다.
    - 생성 성공 시 프로젝트와 리더 멤버 매핑이 함께 생성됩니다.
    """
    project = Project(
        idea_id=payload.idea_id,
        leader_id=current_user_id,
        title=payload.title,
        summary=payload.summary,
        description=payload.description,
        category=payload.category,
        difficulty=payload.difficulty,
        status=payload.status,
        progress_percent=payload.progress_percent,
        is_public=payload.is_public,
    )
    db.add(project)
    db.flush()

    db.add(ProjectMember(project_id=project.id, user_id=current_user_id, role_in_project="leader"))
    db.commit()
    db.refresh(project)
    return success_response(data={"id": project.id, "title": project.title})


@router.get("", summary="프로젝트 목록", description="프로젝트 목록을 페이지네이션과 상태 필터로 조회합니다.")
async def list_projects(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 목록 조회 API.

    Swagger 테스트 방법:
    - query `page`, `size`, `status`로 필터/페이지네이션을 적용합니다.
    - meta에 전체 건수(total)를 함께 반환합니다.
    """
    query = db.query(Project)
    query = query.filter(Project.deleted_at.is_(None))
    if status_filter:
        query = query.filter(Project.status == status_filter)

    total = query.count()
    projects = query.order_by(Project.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return success_response(
        data=[
            {
                "id": p.id,
                "title": p.title,
                "status": p.status,
                "difficulty": p.difficulty,
                "progress_percent": float(p.progress_percent),
                "leader_id": p.leader_id,
            }
            for p in projects
        ],
        meta={"page": page, "size": size, "total": total},
    )


@router.get("/{project_id}", summary="프로젝트 상세", description="프로젝트 상세와 활성 멤버 목록을 조회합니다.")
async def get_project(project_id: int, db: Session = Depends(get_db)) -> dict:
    """프로젝트 상세 조회 API.

    Swagger 테스트 방법:
    - path의 `project_id`를 전달합니다.
    - 프로젝트 기본 정보와 활성 멤버 목록을 함께 반환합니다.
    """
    project = _get_project_or_404(db, project_id)
    members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id, ProjectMember.left_at.is_(None)).all()
    return success_response(
        data={
            "id": project.id,
            "title": project.title,
            "summary": project.summary,
            "description": project.description,
            "status": project.status,
            "difficulty": project.difficulty,
            "progress_percent": float(project.progress_percent),
            "leader_id": project.leader_id,
            "members": [{"user_id": m.user_id, "role_in_project": m.role_in_project} for m in members],
        }
    )


@router.post("/{project_id}/applications", summary="프로젝트 지원", description="현재 사용자가 프로젝트에 지원합니다.")
async def apply_project(
    project_id: int,
    payload: ApplicationCreateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 지원 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정하고 message를 포함해 호출합니다.
    - 동일 프로젝트 중복 지원 시 `409`를 반환합니다.
    """
    _get_project_or_404(db, project_id)
    exists = db.query(Application).filter(Application.project_id == project_id, Application.applicant_id == current_user_id).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Application already exists")

    app_obj = Application(project_id=project_id, applicant_id=current_user_id, message=payload.message, status="pending")
    db.add(app_obj)
    db.commit()
    db.refresh(app_obj)
    return success_response(data={"id": app_obj.id, "status": app_obj.status})


@router.get("/{project_id}/applications", summary="지원자 목록", description="프로젝트 리더가 지원자 목록을 조회합니다.")
async def list_applications(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """지원자 목록 조회 API(리더 전용).

    Swagger 테스트 방법:
    - 프로젝트 리더 계정으로 호출합니다.
    - 리더 권한이 없으면 `403`을 반환합니다.
    """
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)
    apps = db.query(Application).filter(Application.project_id == project_id).order_by(Application.id.desc()).all()
    return success_response(
        data=[
            {"id": a.id, "applicant_id": a.applicant_id, "message": a.message, "status": a.status}
            for a in apps
        ]
    )


@router.patch("/{project_id}/applications/{application_id}", summary="지원 승인/거절", description="리더가 지원 상태를 accepted/rejected로 변경합니다.")
async def decide_application(
    project_id: int,
    application_id: int,
    payload: ApplicationDecisionRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """지원 승인/거절 API(리더 전용).

    Swagger 테스트 방법:
    - body `status`는 accepted/rejected만 허용됩니다.
    - accepted면 프로젝트 멤버 테이블에 자동 반영됩니다.
    """
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)

    app_obj = db.get(Application, application_id)
    if app_obj is None or app_obj.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    decision = payload.status
    if decision not in {"accepted", "rejected"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="status must be accepted or rejected")

    app_obj.status = decision
    app_obj.decided_by = current_user_id
    app_obj.decided_at = datetime.now(timezone.utc)

    if decision == "accepted":
        exists_member = db.query(ProjectMember).filter(ProjectMember.project_id == project_id, ProjectMember.user_id == app_obj.applicant_id).first()
        if exists_member is None:
            db.add(ProjectMember(project_id=project_id, user_id=app_obj.applicant_id, role_in_project=payload.role_in_project or "member"))

    db.commit()
    return success_response(data={"id": app_obj.id, "status": app_obj.status})


@router.patch("/{project_id}", summary="프로젝트 수정", description="리더가 프로젝트 메타데이터를 부분 수정합니다.")
async def update_project(
    project_id: int,
    payload: ProjectUpdateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 메타데이터 수정 API.

    Swagger 테스트 방법:
    - 리더 계정으로 호출하고 수정할 필드만 전달합니다.
    - partial update 방식으로 동작합니다.
    """
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)
    return success_response(data={"id": project.id, "updated": True})


@router.delete("/{project_id}", summary="프로젝트 삭제", description="프로젝트를 soft delete 처리합니다.")
async def delete_project(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 삭제 API(soft delete).

    Swagger 테스트 방법:
    - 리더 계정으로 호출합니다.
    - 실제 삭제 대신 deleted_at을 기록합니다.
    """
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)
    project.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return success_response(data={"deleted": True, "id": project_id})


@router.patch("/{project_id}/status", summary="프로젝트 상태 변경", description="planning/in_progress/paused/completed 등 상태를 갱신합니다.")
async def update_project_status(
    project_id: int,
    payload: ProjectStatusUpdateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 상태 변경 API.

    Swagger 테스트 방법:
    - 리더 계정으로 호출합니다.
    - body의 status 값으로 planning/in_progress/paused/completed 등을 전달합니다.
    """
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)

    project.status = payload.status
    db.commit()
    return success_response(data={"id": project.id, "status": project.status})


@router.post("/{project_id}/milestones", summary="마일스톤 생성", description="프로젝트 마일스톤을 생성합니다.")
async def create_milestone(
    project_id: int,
    payload: MilestoneCreateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """마일스톤 생성 API(리더 전용)."""
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)
    milestone = ProjectMilestone(
        project_id=project_id,
        title=payload.title,
        description=payload.description,
        due_date=payload.due_date,
        is_done=payload.is_done,
    )
    db.add(milestone)
    db.commit()
    db.refresh(milestone)
    return success_response(data={"id": milestone.id, "title": milestone.title})


@router.patch("/{project_id}/milestones/{milestone_id}", summary="마일스톤 수정", description="마일스톤 제목/설명/완료 상태를 수정합니다.")
async def update_milestone(
    project_id: int,
    milestone_id: int,
    payload: MilestoneUpdateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """마일스톤 수정 API(리더 전용)."""
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)

    milestone = db.get(ProjectMilestone, milestone_id)
    if milestone is None or milestone.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(milestone, field, value)

    db.commit()
    return success_response(data={"id": milestone.id, "updated": True})


@router.get("/{project_id}/progress", summary="진행률 조회", description="Todo 기반 프로젝트 진행률을 계산해 반환합니다.")
async def get_project_progress(project_id: int, db: Session = Depends(get_db)) -> dict:
    """프로젝트 진행률 조회 API.

    Swagger 테스트 방법:
    - Todo 전체/완료 개수를 기준으로 진행률을 계산해 반환합니다.
    """
    _get_project_or_404(db, project_id)
    total = db.query(func.count(Todo.id)).filter(Todo.project_id == project_id).scalar() or 0
    done = db.query(func.count(Todo.id)).filter(Todo.project_id == project_id, Todo.status == "done").scalar() or 0
    percent = round((done / total) * 100, 2) if total else 0.0
    return success_response(data={"project_id": project_id, "todo_total": total, "todo_done": done, "progress_percent": percent})


@router.post("/{project_id}/recruitments", summary="재모집 포지션 생성", description="리더가 결원 포지션에 대한 재모집을 생성합니다.")
async def create_recruitment(
    project_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """재모집 포지션 생성 API(리더 전용).

    Swagger 테스트 방법:
    - body `position_name`은 필수입니다.
    """
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)
    if not payload.get("position_name"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="position_name is required")

    recruitment = ProjectRecruitment(
        project_id=project_id,
        position_name=payload["position_name"],
        required_count=payload.get("required_count", 1),
        status=payload.get("status", "open"),
        description=payload.get("description"),
    )
    db.add(recruitment)
    db.commit()
    db.refresh(recruitment)
    return success_response(data={"id": recruitment.id, "status": recruitment.status})


@router.patch("/{project_id}/recruitments/{recruitment_id}", summary="재모집 수정", description="재모집의 상태/인원/설명을 갱신합니다.")
async def update_recruitment(
    project_id: int,
    recruitment_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """재모집 포지션 수정 API(리더 전용)."""
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)

    recruitment = db.get(ProjectRecruitment, recruitment_id)
    if recruitment is None or recruitment.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recruitment not found")

    for field in ("position_name", "required_count", "status", "description"):
        if field in payload:
            setattr(recruitment, field, payload[field])

    db.commit()
    return success_response(data={"id": recruitment.id, "updated": True})


@router.post("/{project_id}/invite", summary="멤버 초대", description="리더가 특정 유저를 프로젝트로 초대합니다.")
async def invite_user(
    project_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 멤버 초대 API(리더 전용).

    Swagger 테스트 방법:
    - body `invitee_id` 필수, `message` 선택 전달.
    """
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)

    invitee_id = payload.get("invitee_id")
    if not invitee_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invitee_id is required")

    invite = Invitation(
        project_id=project_id,
        inviter_id=current_user_id,
        invitee_id=invitee_id,
        message=payload.get("message"),
        status="pending",
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return success_response(data={"id": invite.id, "status": invite.status})


@router.post("/{project_id}/invite/{invite_id}/accept", summary="초대 수락", description="초대받은 사용자가 프로젝트 초대를 수락합니다.")
async def accept_invite(
    project_id: int,
    invite_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """초대 수락 API.

    Swagger 테스트 방법:
    - 초대받은 사용자 본인이 호출해야 하며, 수락 시 멤버가 자동 등록됩니다.
    """
    _get_project_or_404(db, project_id)
    invite = db.get(Invitation, invite_id)
    if invite is None or invite.project_id != project_id or invite.invitee_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    invite.status = "accepted"
    invite.decided_at = datetime.now(timezone.utc)
    exists_member = db.query(ProjectMember).filter(ProjectMember.project_id == project_id, ProjectMember.user_id == current_user_id).first()
    if exists_member is None:
        db.add(ProjectMember(project_id=project_id, user_id=current_user_id, role_in_project="member"))

    db.commit()
    return success_response(data={"id": invite.id, "status": invite.status})


@router.post("/{project_id}/invite/{invite_id}/reject", summary="초대 거절", description="초대받은 사용자가 프로젝트 초대를 거절합니다.")
async def reject_invite(
    project_id: int,
    invite_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """초대 거절 API.

    Swagger 테스트 방법:
    - 초대받은 사용자 본인이 호출해야 합니다.
    """
    _get_project_or_404(db, project_id)
    invite = db.get(Invitation, invite_id)
    if invite is None or invite.project_id != project_id or invite.invitee_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    invite.status = "rejected"
    invite.decided_at = datetime.now(timezone.utc)
    db.commit()
    return success_response(data={"id": invite.id, "status": invite.status})


@router.post("/{project_id}/members", summary="멤버 직접 추가", description="리더가 프로젝트 멤버를 직접 추가합니다.")
async def add_member(
    project_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """멤버 직접 추가 API(리더 전용).

    Swagger 테스트 방법:
    - body `user_id` 필수, `role_in_project` 선택 전달.
    """
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id is required")

    exists = db.query(ProjectMember).filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Member already exists")

    member = ProjectMember(project_id=project_id, user_id=user_id, role_in_project=payload.get("role_in_project", "member"))
    db.add(member)
    db.commit()
    return success_response(data={"project_id": project_id, "user_id": user_id})


@router.delete("/{project_id}/members/{member_id}", summary="멤버 제거", description="리더가 프로젝트 멤버를 제거합니다.")
async def remove_member(
    project_id: int,
    member_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """멤버 제거 API(리더 전용)."""
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)

    member = db.get(ProjectMember, member_id)
    if member is None or member.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    db.delete(member)
    db.commit()
    return success_response(data={"removed": True, "member_id": member_id})


@router.post("/{project_id}/todos", summary="Todo 생성", description="프로젝트 멤버가 Todo를 생성합니다.")
async def create_todo(
    project_id: int,
    payload: TodoCreateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """Todo 생성 API(프로젝트 멤버 전용)."""
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)

    todo = Todo(
        project_id=project_id,
        creator_id=current_user_id,
        assignee_id=payload.assignee_id,
        title=payload.title,
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        due_date=payload.due_date,
    )
    db.add(todo)
    db.commit()
    db.refresh(todo)
    return success_response(data={"id": todo.id, "status": todo.status})


@router.get("/{project_id}/todos", summary="Todo 목록", description="프로젝트 멤버가 Todo 목록을 조회합니다.")
async def list_todos(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """Todo 목록 조회 API(프로젝트 멤버 전용)."""
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)
    todos = db.query(Todo).filter(Todo.project_id == project_id).order_by(Todo.id.desc()).all()
    return success_response(
        data=[
            {
                "id": t.id,
                "title": t.title,
                "status": t.status,
                "priority": t.priority,
                "assignee_id": t.assignee_id,
            }
            for t in todos
        ]
    )


@router.patch("/{project_id}/todos/{todo_id}", summary="Todo 수정", description="Todo 내용을 부분 수정하고 done 상태면 완료 시각을 기록합니다.")
async def update_todo(
    project_id: int,
    todo_id: int,
    payload: TodoUpdateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """Todo 수정 API(프로젝트 멤버 전용).

    Swagger 테스트 방법:
    - status를 done으로 바꾸면 completed_at이 자동 기록됩니다.
    """
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)
    todo = db.get(Todo, todo_id)
    if todo is None or todo.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(todo, field, value)

    if todo.status == "done" and todo.completed_at is None:
        todo.completed_at = datetime.now(timezone.utc)

    db.commit()
    return success_response(data={"id": todo.id, "updated": True})


@router.delete("/{project_id}/todos/{todo_id}", summary="Todo 삭제", description="프로젝트 멤버가 Todo를 삭제합니다.")
async def delete_todo(
    project_id: int,
    todo_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """Todo 삭제 API(프로젝트 멤버 전용)."""
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)
    todo = db.get(Todo, todo_id)
    if todo is None or todo.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")
    db.delete(todo)
    db.commit()
    return success_response(data={"deleted": True, "todo_id": todo_id})


@router.post("/{project_id}/retrospectives", summary="회고 작성", description="프로젝트 멤버가 회고를 작성합니다.")
async def create_retrospective(
    project_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """회고 작성 API(프로젝트 멤버 전용).

    Swagger 테스트 방법:
    - body `title`은 필수입니다.
    """
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)
    if not payload.get("title"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="title is required")

    retro = Retrospective(
        project_id=project_id,
        author_id=current_user_id,
        title=payload["title"],
        what_went_well=payload.get("what_went_well"),
        what_went_badly=payload.get("what_went_badly"),
        lessons_learned=payload.get("lessons_learned"),
        next_actions=payload.get("next_actions"),
    )
    db.add(retro)
    db.commit()
    db.refresh(retro)
    return success_response(data={"id": retro.id, "title": retro.title})


@router.get("/{project_id}/retrospectives", summary="회고 목록", description="프로젝트 멤버가 회고 목록을 조회합니다.")
async def list_retrospectives(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """회고 목록 조회 API(프로젝트 멤버 전용)."""
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)
    retros = db.query(Retrospective).filter(Retrospective.project_id == project_id).order_by(Retrospective.id.desc()).all()
    return success_response(data=[{"id": r.id, "title": r.title, "author_id": r.author_id} for r in retros])


@router.get("/{project_id}/retrospectives/{retrospective_id}", summary="회고 상세", description="프로젝트 멤버가 회고 상세를 조회합니다.")
async def get_retrospective(
    project_id: int,
    retrospective_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """회고 상세 조회 API(프로젝트 멤버 전용)."""
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)
    retro = db.get(Retrospective, retrospective_id)
    if retro is None or retro.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retrospective not found")
    return success_response(
        data={
            "id": retro.id,
            "title": retro.title,
            "what_went_well": retro.what_went_well,
            "what_went_badly": retro.what_went_badly,
            "lessons_learned": retro.lessons_learned,
            "next_actions": retro.next_actions,
        }
    )


@router.patch("/{project_id}/retrospectives/{retrospective_id}", summary="회고 수정", description="회고 작성자가 회고 내용을 수정합니다.")
async def update_retrospective(
    project_id: int,
    retrospective_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """회고 수정 API(작성자 전용)."""
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)
    retro = db.get(Retrospective, retrospective_id)
    if retro is None or retro.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retrospective not found")
    if retro.author_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only author can update")

    for field in ("title", "what_went_well", "what_went_badly", "lessons_learned", "next_actions"):
        if field in payload:
            setattr(retro, field, payload[field])

    db.commit()
    return success_response(data={"id": retro.id, "updated": True})


@router.post("/{project_id}/failure-stories", summary="실패 경험 등록", description="프로젝트 실패 경험을 기록합니다.")
async def create_failure_story(
    project_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """실패 경험 등록 API.

    Swagger 테스트 방법:
    - body `title`, `problem_summary`는 필수입니다.
    """
    _get_project_or_404(db, project_id)
    if not payload.get("title") or not payload.get("problem_summary"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="title and problem_summary are required")

    story = FailureStory(
        project_id=project_id,
        author_id=current_user_id,
        title=payload["title"],
        problem_summary=payload["problem_summary"],
        root_cause=payload.get("root_cause"),
        attempted_solutions=payload.get("attempted_solutions"),
        lessons_learned=payload.get("lessons_learned"),
        is_public=payload.get("is_public", True),
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    return success_response(data={"id": story.id, "title": story.title})


@router.get("/{project_id}/failure-stories", summary="프로젝트 실패 경험 목록", description="프로젝트 멤버가 실패 경험 목록을 조회합니다.")
async def list_failure_stories(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 실패 경험 목록 API(프로젝트 멤버 전용)."""
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)
    stories = db.query(FailureStory).filter(FailureStory.project_id == project_id).order_by(FailureStory.id.desc()).all()
    return success_response(data=[{"id": s.id, "title": s.title, "is_public": s.is_public} for s in stories])


@router.get("/failure-stories", summary="실패 경험 통합 탐색", description="공개된 실패 경험을 전체 조회합니다.")
async def list_all_failure_stories(db: Session = Depends(get_db)) -> dict:
    """실패 경험 통합 탐색 API.

    Swagger 테스트 방법:
    - 공개(`is_public=true`)된 실패 경험만 반환합니다.
    """
    stories = db.query(FailureStory).filter(FailureStory.is_public.is_(True)).order_by(FailureStory.id.desc()).all()
    return success_response(data=[{"id": s.id, "project_id": s.project_id, "title": s.title} for s in stories])


@router.post("/{project_id}/reviews", summary="프로젝트 리뷰 작성", description="프로젝트 멤버가 팀원을 리뷰하고 평점을 반영합니다.")
async def create_review(
    project_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 리뷰 작성 API(멤버 전용).

    Swagger 테스트 방법:
    - reviewee_id 필수, 자기 자신 리뷰는 불가합니다.
    - 중복 리뷰를 방지하며 생성 후 평점 집계를 재계산합니다.
    """
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)
    reviewee_id = payload.get("reviewee_id")
    if not reviewee_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="reviewee_id is required")
    if reviewee_id == current_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot review yourself")

    existing = (
        db.query(Review)
        .filter(Review.project_id == project_id, Review.reviewer_id == current_user_id, Review.reviewee_id == reviewee_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Review already exists")

    review = Review(
        project_id=project_id,
        reviewer_id=current_user_id,
        reviewee_id=reviewee_id,
        teamwork_score=payload.get("teamwork_score", 3),
        contribution_score=payload.get("contribution_score", 3),
        responsibility_score=payload.get("responsibility_score", 3),
        comment=payload.get("comment"),
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    # Aggregate is recomputed each time to keep rating endpoint accurate.
    aggregate_row = (
        db.query(
            func.count(Review.id),
            func.avg(Review.teamwork_score),
            func.avg(Review.contribution_score),
            func.avg(Review.responsibility_score),
        )
        .filter(Review.reviewee_id == reviewee_id)
        .one()
    )
    aggregate = db.get(UserRatingAggregate, reviewee_id)
    if aggregate is None:
        aggregate = UserRatingAggregate(user_id=reviewee_id)
        db.add(aggregate)

    aggregate.review_count = int(aggregate_row[0] or 0)
    aggregate.avg_teamwork = round(float(aggregate_row[1] or 0), 2)
    aggregate.avg_contribution = round(float(aggregate_row[2] or 0), 2)
    aggregate.avg_responsibility = round(float(aggregate_row[3] or 0), 2)
    db.commit()

    return success_response(data={"id": review.id})


@router.get("/{project_id}/reviews", summary="프로젝트 리뷰 목록", description="프로젝트 멤버가 리뷰 목록을 조회합니다.")
async def list_project_reviews(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 리뷰 목록 조회 API(멤버 전용)."""
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)
    reviews = db.query(Review).filter(Review.project_id == project_id).order_by(Review.id.desc()).all()
    return success_response(
        data=[
            {
                "id": r.id,
                "reviewer_id": r.reviewer_id,
                "reviewee_id": r.reviewee_id,
                "teamwork_score": r.teamwork_score,
                "contribution_score": r.contribution_score,
                "responsibility_score": r.responsibility_score,
                "comment": r.comment,
            }
            for r in reviews
        ]
    )
