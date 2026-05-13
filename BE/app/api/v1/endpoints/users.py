from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Body, Depends, HTTPException, status, File, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id
from app.models import Idea
from app.models import IdeaBookmark
from app.models import Application
from app.models import Project
from app.models import ProjectMember
from app.models import Review
from app.models import Skill
from app.models import Todo
from app.models import User
from app.models import UserInterest
from app.models import UserRatingAggregate
from app.models import UserSkill
from app.models import Interest
from app.schemas.users import OnboardingIdeaSelectionRequest
from app.schemas.users import UserProfileUpdateRequest
from app.services.s3_upload import extract_s3_key_from_url
from app.services.s3_upload import get_s3_service
from app.services.s3_upload import resolve_avatar_url

router = APIRouter()


def _calculate_project_progress_percent(db: Session, project_id: int) -> float:
    total = (
        db.query(func.count(Todo.id))
        .filter(Todo.project_id == project_id)
        .scalar()
        or 0
    )
    if total == 0:
        return 0.0

    done = (
        db.query(func.count(Todo.id))
        .filter(Todo.project_id == project_id, Todo.status == "done")
        .scalar()
        or 0
    )
    return round((done / total) * 100, 2)


def _get_avatar_url(user: User | None) -> str | None:
    if user is None:
        return None

    return resolve_avatar_url(user.avatar_s3_key, user.avatar_url)


def _backfill_avatar_s3_key_from_url(user: User) -> bool:
    if user.avatar_s3_key or not user.avatar_url:
        return False

    s3_key = extract_s3_key_from_url(user.avatar_url)
    if not s3_key:
        return False

    user.avatar_s3_key = s3_key
    return True


def _serialize_review(db: Session, review: Review) -> dict:
    reviewer = db.get(User, review.reviewer_id)
    project = db.get(Project, review.project_id)

    return {
        "id": review.id,
        "reviewer": {
            "id": reviewer.id if reviewer else review.reviewer_id,
            "nickname": reviewer.nickname if reviewer else "탈퇴한 사용자",
            "avatar_url": _get_avatar_url(reviewer),
        },
        "project": {
            "id": project.id if project else review.project_id,
            "title": project.title if project else "삭제된 프로젝트",
        },
        "teamwork_score": review.teamwork_score,
        "contribution_score": review.contribution_score,
        "responsibility_score": review.responsibility_score,
        "comment": review.comment,
        "message": review.comment,
        "created_at": review.created_at,
    }


@router.get("/me/profile", summary="내 프로필 조회", description="현재 로그인한 사용자의 프로필과 기술 스택을 조회합니다.")
async def get_my_profile(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """내 프로필 조회 API.

    Swagger 테스트 방법:
    - `Authorization: Bearer <access_token>` 헤더를 설정합니다.
    """
    user = db.get(User, current_user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if _backfill_avatar_s3_key_from_url(user):
        db.commit()
        db.refresh(user)

    skills = (
        db.query(Skill.name)
        .join(UserSkill, UserSkill.skill_id == Skill.id)
        .filter(UserSkill.user_id == current_user_id)
        .all()
    )
    interests = (
        db.query(Interest.name)
        .join(UserInterest, UserInterest.interest_id == Interest.id)
        .filter(UserInterest.user_id == current_user_id)
        .all()
    )
    selected_idea_ids = (
        db.query(IdeaBookmark.idea_id)
        .filter(IdeaBookmark.user_id == current_user_id)
        .order_by(IdeaBookmark.id.asc())
        .all()
    )
    
    # 현재 참여중인 프로젝트 (멤버로 참여중인 프로젝트)
    participating_projects = (
        db.query(Project)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .filter(
            ProjectMember.user_id == current_user_id,
            Project.deleted_at.is_(None),
        )
        .all()
    )
    participating_project_list = [
        {
            "id": p.id,
            "title": p.title,
            "status": p.status,
            "leader_id": p.leader_id,
        }
        for p in participating_projects
    ]

    return success_response(
        data={
            "id": user.id,
            "email": user.email,
            "nickname": user.nickname,
            "name": user.name,
            "phone_number": user.phone_number,
            "coin_balance": user.coin_balance,
            "bio": user.bio,
            "avatar_url": _get_avatar_url(user),
            "avatar_s3_key": user.avatar_s3_key,
            "skills": [name for (name,) in skills],
            "interests": [name for (name,) in interests],
            "selected_idea_ids": [idea_id for (idea_id,) in selected_idea_ids],
            "participating_projects": participating_project_list,
            "onboarding_step": user.onboarding_step,
            "onboarding_completed_at": user.onboarding_completed_at,
        },
    )
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    skills = (
        db.query(Skill.name)
        .join(UserSkill, UserSkill.skill_id == Skill.id)
        .filter(UserSkill.user_id == current_user_id)
        .all()
    ),


@router.post("/me/avatar", summary="아바타 업로드", description="마이페이지에서 사용자 아바타(사진)를 업로드합니다.")
async def upload_my_avatar(
    file: UploadFile = File(...),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
    s3_service = Depends(get_s3_service),
) -> dict:
    """사용자 아바타 업로드 API.

    - Accepts image files only (content-type starts with `image/`).
    - Uploads to a private S3 bucket and stores only the object key.
    - Returns a temporary presigned GET URL as `avatar_url`.
    """
    user = db.get(User, current_user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if _backfill_avatar_s3_key_from_url(user):
        db.commit()
        db.refresh(user)

    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only image uploads are allowed")

    content = await file.read()

    upload_result = await s3_service.upload_avatar(
        content,
        user.id,
        file.filename or "avatar",
        content_type,
    )

    user.avatar_s3_key = upload_result["s3_key"]
    user.avatar_url = None
    db.commit()
    db.refresh(user)

    return success_response(
        data={
            "avatar_url": _get_avatar_url(user),
            "avatar_s3_key": user.avatar_s3_key,
        }
    )


@router.get("/me/onboarding", summary="내 온보딩 상태 조회", description="회원가입/프로필/관심 아이디어 선택 진행 상태를 조회합니다.")
async def get_my_onboarding_state(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, current_user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    selected_idea_ids = (
        db.query(IdeaBookmark.idea_id)
        .filter(IdeaBookmark.user_id == current_user_id)
        .order_by(IdeaBookmark.id.asc())
        .all()
    )

    return success_response(
        data={
            "onboarding_step": user.onboarding_step,
            "profile_ready": bool(user.name and user.phone_number),
            "completed": user.onboarding_step == "completed",
            "selected_idea_ids": [idea_id for (idea_id,) in selected_idea_ids],
            "onboarding_completed_at": user.onboarding_completed_at,
        },
    )


@router.patch("/me/profile", summary="내 프로필 수정", description="닉네임/소개/아바타 URL을 수정합니다.")
async def update_my_profile(
    payload: UserProfileUpdateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """내 프로필 수정 API.

    Swagger 테스트 방법:
    - body에 수정할 필드만 선택해서 전달하면 부분 업데이트됩니다.
    """
    user = db.get(User, current_user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if _backfill_avatar_s3_key_from_url(user):
        db.commit()
        db.refresh(user)

    if payload.nickname is not None and payload.nickname != user.nickname:
        duplicate = db.query(User).filter(User.nickname == payload.nickname, User.id != user.id, User.deleted_at.is_(None)).first()
        if duplicate:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 존재하는 닉네임입니다.")

    for field in ("nickname", "name", "phone_number", "bio", "avatar_url"):
        value = getattr(payload, field)
        if value is not None:
            setattr(user, field, value)

    if user.onboarding_step == "profile_pending" and user.name and user.phone_number:
        user.onboarding_step = "ideas_pending"

    db.commit()
    db.refresh(user)
    return success_response(
        data={
            "id": user.id,
            "nickname": user.nickname,
            "name": user.name,
            "phone_number": user.phone_number,
            "coin_balance": user.coin_balance,
            "bio": user.bio,
            "avatar_url": _get_avatar_url(user),
            "avatar_s3_key": user.avatar_s3_key,
            "onboarding_step": user.onboarding_step,
        },
    )


@router.delete("/me", summary="회원 탈퇴", description="현재 로그인한 사용자를 탈퇴 처리합니다.")
async def withdraw_my_account(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, current_user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    now = datetime.now(timezone.utc)
    user.password_hash = None
    user.is_active = False
    user.deleted_at = now

    db.commit()
    return success_response(data={"withdrawn": True})


@router.get("/me/onboarding", summary="내 온보딩 상태 조회", description="회원가입/프로필/관심 아이디어 선택 진행 상태를 조회합니다.")
async def get_my_onboarding_state(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, current_user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    selected_idea_ids = (
        db.query(IdeaBookmark.idea_id)
        .filter(IdeaBookmark.user_id == current_user_id)
        .order_by(IdeaBookmark.id.asc())
        .all()
    )

    return success_response(
        data={
            "onboarding_step": user.onboarding_step,
            "profile_ready": bool(user.name and user.phone_number),
            "completed": user.onboarding_step == "completed",
            "selected_idea_ids": [idea_id for (idea_id,) in selected_idea_ids],
            "onboarding_completed_at": user.onboarding_completed_at,
        },
    )


@router.get("/me/projects", summary="내 프로젝트 목록", description="현재 사용자가 리더이거나 팀원인 프로젝트를 반환합니다.")
async def get_my_projects(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """내 프로젝트 목록 조회 API.
    
    각 프로젝트에 can_discard 필드를 포함합니다.
    can_discard 조건:
    - 팀 결성이 된 프로젝트 (status가 'started', 'in_progress', 'completed', 'recycled' 중 하나)
    - 또는 아이디어 생성 후 30일 이상 경과한 프로젝트
    
    Swagger 테스트 방법:
    - Authorization 헤더에 Bearer access token을 넣습니다.
    """
    projects = (
        db.query(Project)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .filter(
            ProjectMember.user_id == current_user_id,
            ProjectMember.left_at.is_(None),
            Project.deleted_at.is_(None),
        )
        .order_by(Project.created_at.desc())
        .all()
    )

    if not projects:
        projects = (
            db.query(Project)
            .filter(Project.leader_id == current_user_id, Project.deleted_at.is_(None))
            .order_by(Project.created_at.desc())
            .all()
        )

    project_ids = [project.id for project in projects]
    active_chat_project_ids = set()
    if project_ids:
        active_chat_project_ids = {
            project_id
            for (project_id,) in (
                db.query(Project.id)
                .join(ProjectMember, ProjectMember.project_id == Project.id)
                .filter(
                    Project.id.in_(project_ids),
                    ProjectMember.user_id == current_user_id,
                    ProjectMember.left_at.is_(None),
                )
                .all()
            )
        }

    member_counts = dict(
        db.query(ProjectMember.project_id, func.count(ProjectMember.id))
        .filter(ProjectMember.project_id.in_(project_ids), ProjectMember.left_at.is_(None))
        .group_by(ProjectMember.project_id)
        .all()
    ) if project_ids else {}
    
    response_data = []
    now = datetime.now(timezone.utc)
    
    for project in projects:
        # 팀 결성 여부: status가 'planning' 이상인 경우
        team_formed = project.status != "planning"
        
        # 아이디어 생성 후 30일 이상 경과 여부
        days_since_creation = (now - project.created_at.replace(tzinfo=timezone.utc)).days if project.created_at else 0
        time_elapsed_30_days = days_since_creation >= 30
        
        # can_discard 조건: 완료 전 프로젝트 중 팀 결성됐거나 30일 이상 경과
        can_discard = project.status != "completed" and (team_formed or time_elapsed_30_days)
        
        response_data.append({
            "id": project.id,
            "title": project.title,
            "status": project.status,
            "difficulty": project.difficulty,
            "category": project.category,
            "progress_percent": _calculate_project_progress_percent(db, project.id),
            "created_at": project.created_at.isoformat() if project.created_at else None,
            "can_discard": can_discard,
            "can_chat": project.id in active_chat_project_ids,
            "is_leader": project.leader_id == current_user_id,
            "currentMembers": member_counts.get(project.id, 0),
            "maxMembers": project.max_members,
        })
    
    return success_response(data=response_data)


@router.get("/{user_id}/profile", summary="공개 프로필 조회", description="특정 사용자의 공개 프로필을 조회합니다.")
async def get_user_profile(user_id: int, db: Session = Depends(get_db)) -> dict:
    """공개 프로필 조회 API.

    Swagger 테스트 방법:
    - path의 `user_id`에 조회 대상을 전달합니다.

    검증/응답:
    - 사용자가 없거나 삭제 상태면 `404`를 반환합니다.
    - 공개 가능한 기본 정보(닉네임/소개/아바타/역할)를 반환합니다.
    """
    user = db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    interests = (
        db.query(Interest.name)
        .join(UserInterest, UserInterest.interest_id == Interest.id)
        .filter(UserInterest.user_id == user_id)
        .all()
    )
    return success_response(
        data={
            "id": user.id,
            "nickname": user.nickname,
            "bio": user.bio,
            "avatar_url": _get_avatar_url(user),
            "role": user.role,
            "interests": [name for (name,) in interests],
        },
    )


@router.get("/{user_id}/stats", summary="사용자 활동 통계", description="리드 프로젝트 수, 완료 수, 리뷰 수를 집계합니다.")
async def get_user_stats(user_id: int, db: Session = Depends(get_db)) -> dict:
    """사용자 활동 통계 API.

    Swagger 테스트 방법:
    - path의 `user_id`를 전달합니다.

    집계 항목:
    - lead_projects: 리더로 참여한 프로젝트 수
    - completed_projects: 완료 상태 프로젝트 수
    - review_received: 받은 리뷰 수
    """
    joined_count = db.query(func.count(Project.id)).filter(Project.leader_id == user_id, Project.deleted_at.is_(None)).scalar() or 0
    completed_count = db.query(func.count(Project.id)).filter(Project.leader_id == user_id, Project.status == "completed", Project.deleted_at.is_(None)).scalar() or 0
    review_count = db.query(func.count(Review.id)).filter(Review.reviewee_id == user_id).scalar() or 0

    return success_response(
        data={
            "user_id": user_id,
            "lead_projects": joined_count,
            "completed_projects": completed_count,
            "review_received": review_count,
        },
    )


@router.get("/{user_id}/projects", summary="사용자 프로젝트 이력", description="사용자가 리더로 참여한 프로젝트 이력을 반환합니다.")
async def get_user_projects(user_id: int, db: Session = Depends(get_db)) -> dict:
    """사용자 프로젝트 이력 조회 API.

    Swagger 테스트 방법:
    - path의 `user_id`를 전달합니다.

    응답:
    - 사용자가 리더인 프로젝트 목록을 생성일 역순으로 반환합니다.
    """
    projects = db.query(Project).filter(Project.leader_id == user_id, Project.deleted_at.is_(None)).order_by(Project.created_at.desc()).all()
    return success_response(
        data=[
            {
                "id": project.id,
                "title": project.title,
                "status": project.status,
                "difficulty": project.difficulty,
                "progress_percent": float(project.progress_percent),
                "created_at": project.created_at,
            }
            for project in projects
        ],
    )


@router.post("/me/skills", summary="내 기술 스택 추가", description="기술 이름과 숙련도를 등록합니다.")
async def add_my_skill(
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """내 기술 스택 추가 API.

    Swagger 테스트 방법:
    - body 예시: `{ "name": "FastAPI", "proficiency": 4 }`
    """
    skill_name = payload.get("name")
    proficiency = payload.get("proficiency")
    if not skill_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="name is required")

    normalized = skill_name.strip().lower()
    skill = db.query(Skill).filter(Skill.normalized_name == normalized).first()
    if skill is None:
        skill = Skill(name=skill_name.strip(), normalized_name=normalized)
        db.add(skill)
        db.flush()

    exists = db.query(UserSkill).filter(UserSkill.user_id == current_user_id, UserSkill.skill_id == skill.id).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Skill already registered")

    user_skill = UserSkill(user_id=current_user_id, skill_id=skill.id, proficiency=proficiency)
    db.add(user_skill)
    db.commit()
    return success_response(data={"skill_id": skill.id, "name": skill.name, "proficiency": proficiency})


@router.delete("/me/skills/{skill_id}", summary="내 기술 스택 삭제", description="등록된 기술 스택 매핑을 제거합니다.")
async def remove_my_skill(
    skill_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """내 기술 스택 삭제 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.
    - path의 `skill_id`는 Skill 테이블 ID입니다.

    검증:
    - 사용자-기술 매핑이 없으면 `404`를 반환합니다.
    """
    user_skill = db.query(UserSkill).filter(UserSkill.user_id == current_user_id, UserSkill.skill_id == skill_id).first()
    if user_skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill mapping not found")
    db.delete(user_skill)
    db.commit()
    return success_response(data={"removed": True, "skill_id": skill_id})


@router.post("/me/interests", summary="내 관심 분야 추가", description="관심 분야 이름과 관심 강도를 등록합니다.")
async def add_my_interest(
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """내 관심 분야 추가 API.

    Swagger 테스트 방법:
    - body 예시: `{ "name": "AI", "interest_level": 4 }`
    """
    interest_name = payload.get("name")
    interest_level = payload.get("interest_level")
    if not interest_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="name is required")

    if interest_level is not None:
        if not isinstance(interest_level, int) or interest_level < 1 or interest_level > 5:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="interest_level must be an integer between 1 and 5")

    normalized = interest_name.strip().lower()
    interest = db.query(Interest).filter(Interest.normalized_name == normalized).first()
    if interest is None:
        interest = Interest(name=interest_name.strip(), normalized_name=normalized)
        db.add(interest)
        db.flush()

    exists = db.query(UserInterest).filter(UserInterest.user_id == current_user_id, UserInterest.interest_id == interest.id).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Interest already registered")

    user_interest = UserInterest(user_id=current_user_id, interest_id=interest.id, interest_level=interest_level)
    db.add(user_interest)
    db.commit()
    return success_response(data={"interest_id": interest.id, "name": interest.name, "interest_level": interest_level})


@router.post("/me/onboarding/ideas", summary="온보딩 관심 아이디어 선택", description="회원가입 마지막 단계에서 관심 있는 아이디어를 선택하고 온보딩을 완료합니다.")
async def select_onboarding_ideas(
    payload: OnboardingIdeaSelectionRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, current_user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not user.name or not user.phone_number:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Complete profile before selecting ideas")

    selected_idea_ids = []
    created_bookmarks = 0
    for idea_id in payload.idea_ids:
        idea = db.get(Idea, idea_id)
        if idea is None or idea.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Idea not found: {idea_id}")

        bookmark = db.query(IdeaBookmark).filter(IdeaBookmark.user_id == current_user_id, IdeaBookmark.idea_id == idea_id).first()
        if bookmark is None:
            bookmark = IdeaBookmark(user_id=current_user_id, idea_id=idea_id)
            db.add(bookmark)
            created_bookmarks += 1
        selected_idea_ids.append(idea_id)

    user.onboarding_step = "completed"
    user.onboarding_completed_at = datetime.now(timezone.utc)
    db.commit()

    return success_response(
        data={
            "completed": True,
            "selected_idea_ids": selected_idea_ids,
            "bookmarks_created": created_bookmarks,
            "onboarding_step": user.onboarding_step,
            "onboarding_completed_at": user.onboarding_completed_at,
        },
    )


@router.delete("/me/interests/{interest_id}", summary="내 관심 분야 삭제", description="등록된 관심 분야 매핑을 제거합니다.")
async def remove_my_interest(
    interest_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    user_interest = db.query(UserInterest).filter(UserInterest.user_id == current_user_id, UserInterest.interest_id == interest_id).first()
    if user_interest is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interest mapping not found")

    db.delete(user_interest)
    db.commit()
    return success_response(data={"removed": True, "interest_id": interest_id})


@router.get("/me/reviews", summary="내가 받은 리뷰 목록", description="팀원들이 남긴 리뷰 목록을 조회합니다.")
async def get_my_reviews(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """내가 받은 리뷰 목록 조회 API (마이페이지용).

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.

    응답:
    - 현재 사용자(reviewee)가 받은 모든 리뷰를 최신순으로 반환합니다.
    - reviewer 정보(닉네임, 아바타)와 프로젝트 정보를 포함합니다.
    """
    reviews = (
        db.query(Review)
        .filter(Review.reviewee_id == current_user_id)
        .order_by(Review.created_at.desc())
        .all()
    )

    return success_response(data=[_serialize_review(db, review) for review in reviews])


@router.get("/{user_id}/reviews", summary="사용자 리뷰 조회", description="특정 사용자가 받은 리뷰 목록을 공개적으로 조회합니다.")
async def get_user_reviews(
    user_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """사용자 리뷰 조회 API (공개).

    인증 불필요. 누구나 다른 사용자의 리뷰 기록을 조회할 수 있습니다.

    테스트 방법:
    - 경로: /api/v1/users/{user_id}/reviews
    - user_id: 조회할 사용자의 ID

    응답:
    - 해당 사용자(reviewee)가 받은 모든 리뷰를 최신순으로 반환합니다.
    - reviewer 정보(id, nickname, avatar_url)와 프로젝트 정보(id, title)를 포함합니다.
    - 각 리뷰의 점수(teamwork, contribution, responsibility)와 코멘트를 포함합니다.
    
    검증:
    - 사용자가 없으면 `404`
    """
    user = db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    reviews = (
        db.query(Review)
        .filter(Review.reviewee_id == user_id)
        .order_by(Review.created_at.desc())
        .all()
    )

    return success_response(data=[_serialize_review(db, review) for review in reviews])


@router.get("/me/reputation", summary="내 신뢰도 조회", description="리뷰 기반 평점 요약을 반환합니다.")
async def get_my_reputation(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """내 신뢰도 조회 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.

    응답:
    - 리뷰가 없으면 review_count=0, score=0.0 반환
    - 리뷰가 있으면 teamwork/contribution/responsibility 평균과 종합 score를 반환
    """
    aggregate = db.get(UserRatingAggregate, current_user_id)
    return success_response(data=_build_reputation_response(aggregate))


def _build_reputation_response(aggregate: UserRatingAggregate | None) -> dict:
    if aggregate is None:
        return {
            "review_count": 0,
            "avg_teamwork": 0.0,
            "avg_contribution": 0.0,
            "avg_responsibility": 0.0,
            "score": 0.0,
        }

    score = float((aggregate.avg_teamwork + aggregate.avg_contribution + aggregate.avg_responsibility) / 3)
    return {
        "review_count": aggregate.review_count,
        "avg_teamwork": round(float(aggregate.avg_teamwork), 2),
        "avg_contribution": round(float(aggregate.avg_contribution), 2),
        "avg_responsibility": round(float(aggregate.avg_responsibility), 2),
        "score": round(score, 2),
    }


@router.get("/{user_id}/reputation", summary="사용자 신뢰도 조회", description="특정 사용자의 리뷰 기반 평점 요약을 반환합니다.")
async def get_user_reputation(user_id: int, db: Session = Depends(get_db)) -> dict:
    user = db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    aggregate = db.get(UserRatingAggregate, user_id)
    return success_response(data=_build_reputation_response(aggregate))


@router.get("/me/applications", summary="내가 지원한 프로젝트 목록", description="사용자가 지원한 프로젝트들의 지원 현황을 조회합니다.")
async def get_my_applications(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """내 지원 목록 조회 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.

    응답:
    - 현재 사용자가 지원한 모든 프로젝트를 최신순으로 반환합니다.
    - 각 지원에 대해 프로젝트 정보, 지원 상태, 경쟁률을 포함합니다.
    """
    applications = (
        db.query(Application)
        .filter(Application.applicant_id == current_user_id)
        .order_by(Application.id.desc())
        .all()
    )

    result = []
    for app in applications:
        project = db.get(Project, app.project_id)
        if project is None or project.deleted_at is not None:
            continue

        # applicant_count: 이 프로젝트에 지원한 사람 수
        applicant_count = (
            db.query(func.count(Application.id))
            .filter(Application.project_id == app.project_id)
            .scalar() or 0
        )

        # current_members: 이 프로젝트의 현재 멤버 수 (왼 것 제외)
        current_members = (
            db.query(func.count(ProjectMember.id))
            .filter(ProjectMember.project_id == app.project_id, ProjectMember.left_at.is_(None))
            .scalar() or 0
        )

        # max_members: 프로젝트 최대 멤버 수
        max_members = project.max_members or 10

        # competition_rate: 경쟁률 (지원자/최대멤버)
        competition_rate = round((applicant_count / max_members * 100) if max_members > 0 else 0, 2)

        result.append(
            {
                "application_id": app.id,
                "project_id": app.project_id,
                "project_title": project.title,
                "message": app.message,
                "status": app.status,
                "project_status": project.status,
                "difficulty": project.difficulty,
                "category": project.category,
                "progress_percent": _calculate_project_progress_percent(db, project.id),
                "applicant_count": applicant_count,
                "current_members": current_members,
                "max_members": max_members,
                "competition_rate": competition_rate,
                "created_at": app.created_at,
            }
        )

    return success_response(data=result)
