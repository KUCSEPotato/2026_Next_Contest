from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id
from app.models import Project
from app.models import Review
from app.models import Skill
from app.models import User
from app.models import UserRatingAggregate
from app.models import UserSkill

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

    return success_response(
        data={
            "id": user.id,
            "email": user.email,
            "nickname": user.nickname,
            "bio": user.bio,
            "avatar_url": user.avatar_url,
            "skills": [name for (name,) in skills],
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
    return success_response(
        data={
            "id": user.id,
            "nickname": user.nickname,
            "bio": user.bio,
            "avatar_url": user.avatar_url,
            "role": user.role,
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
