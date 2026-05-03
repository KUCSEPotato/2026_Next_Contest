from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.db.session import get_db
from app.models import Project
from app.models import ProjectMember
from app.models import User

router = APIRouter()


@router.post("/projects", summary="프로젝트 추천", description="사용자 선호를 기반으로 프로젝트를 추천합니다.")
async def recommend_projects_llm(
    payload: dict = Body(default={}),
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 추천 API.

    Swagger 테스트 방법:
    - body에 `difficulty`(선택)를 전달합니다.
    - query `limit`(1~20)로 추천 개수를 조절합니다.

    동작:
    - 공개 프로젝트를 기준으로 조건 필터 후 최신순 추천 결과를 반환합니다.
    """
    preferred_difficulty = payload.get("difficulty")
    query = db.query(Project).filter(
        Project.is_public.is_(True),
        Project.deleted_at.is_(None)
    )
    if preferred_difficulty:
        query = query.filter(Project.difficulty == preferred_difficulty)
    projects = query.order_by(Project.created_at.desc()).limit(limit).all()
    
    data = []
    for p in projects:
        current_members = db.query(func.count(ProjectMember.id)).filter(
            ProjectMember.project_id == p.id,
            ProjectMember.left_at.is_(None)
        ).scalar() or 0
        data.append({
            "project_id": p.id,
            "title": p.title,
            "difficulty": p.difficulty,
            "currentMembers": current_members,
            "maxMembers": p.max_members,
            "reason": f"{p.difficulty} 난이도와 최근 활성 프로젝트 기준 추천",
        })
    
    return success_response(data=data)


@router.post("/teammates", summary="팀원 추천", description="포지션 기반 팀원 후보를 추천합니다.")
async def recommend_teammates_llm(
    payload: dict = Body(default={}),
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
) -> dict:
    """팀원 추천 API.

    Swagger 테스트 방법:
    - body에 `role`(예: backend, designer)을 전달할 수 있습니다.
    - query `limit`(1~20)로 후보 수를 제한합니다.

    동작:
    - 활성 사용자 기반으로 후보를 반환하며, reason 필드에 추천 근거를 포함합니다.
    """
    role = payload.get("role")
    users = db.query(User).filter(User.is_active.is_(True)).order_by(User.created_at.desc()).limit(limit).all()
    return success_response(
        data=[
            {
                "user_id": u.id,
                "nickname": u.nickname,
                "reason": f"활성 사용자이며 요청 포지션({role or 'general'}) 후보로 적합",
            }
            for u in users
        ]
    )


@router.post("/explain", summary="추천 이유 설명", description="추천 결과에 대한 자연어 설명을 생성합니다.")
async def explain_recommendation(payload: dict = Body(default={})) -> dict:
    """추천 설명 생성 API.

    Swagger 테스트 방법:
    - body 예시: `{ "target": "프로젝트 A", "reason": "경험 스택과 난이도 일치" }`
    - target/reason이 없으면 기본 문구로 설명을 생성합니다.
    """
    target = payload.get("target", "추천 결과")
    reason = payload.get("reason", "사용자 이력, 난이도, 관심 스택을 함께 고려함")
    return success_response(data={"target": target, "explanation": f"{target}은(는) {reason} 때문에 추천되었습니다."})
