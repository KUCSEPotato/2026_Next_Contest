from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id
from app.models import Application
from app.models import Project
from app.models import ProjectMember
from app.models import Review
from app.models import Skill
from app.models import User
from app.models import UserInterest
from app.models import UserRatingAggregate
from app.models import UserSkill
from app.models import Interest

router = APIRouter()


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

    return success_response(
        data={
            "id": user.id,
            "email": user.email,
            "nickname": user.nickname,
            "bio": user.bio,
            "avatar_url": user.avatar_url,
            "skills": [name for (name,) in skills],
            "interests": [name for (name,) in interests],
        },
    )


@router.patch("/me/profile", summary="내 프로필 수정", description="닉네임/소개/아바타 URL을 수정합니다.")
async def update_my_profile(
    payload: dict = Body(default={}),
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

    for field in ("nickname", "bio", "avatar_url"):
        if field in payload:
            setattr(user, field, payload[field])

    db.commit()
    db.refresh(user)
    return success_response(
        data={"id": user.id, "nickname": user.nickname, "bio": user.bio, "avatar_url": user.avatar_url},
    )


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
            "avatar_url": user.avatar_url,
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

    result = []
    for review in reviews:
        reviewer = db.get(User, review.reviewer_id)
        project = db.get(Project, review.project_id)
        result.append(
            {
                "id": review.id,
                "reviewer": {
                    "id": reviewer.id,
                    "nickname": reviewer.nickname,
                    "avatar_url": reviewer.avatar_url,
                },
                "project": {
                    "id": project.id,
                    "title": project.title,
                },
                "teamwork_score": review.teamwork_score,
                "contribution_score": review.contribution_score,
                "responsibility_score": review.responsibility_score,
                "comment": review.comment,
                "created_at": review.created_at,
            }
        )

    return success_response(data=result)


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
    if aggregate is None:
        return success_response(data={"review_count": 0, "score": 0.0})

    score = float((aggregate.avg_teamwork + aggregate.avg_contribution + aggregate.avg_responsibility) / 3)
    return success_response(
        data={
            "review_count": aggregate.review_count,
            "avg_teamwork": float(aggregate.avg_teamwork),
            "avg_contribution": float(aggregate.avg_contribution),
            "avg_responsibility": float(aggregate.avg_responsibility),
            "score": round(score, 2),
        },
    )


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
        if project is None:
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
                "applicant_count": applicant_count,
                "current_members": current_members,
                "max_members": max_members,
                "competition_rate": competition_rate,
                "created_at": app.created_at,
            }
        )

    return success_response(data=result)
