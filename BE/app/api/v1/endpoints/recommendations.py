from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.dependencies.auth import get_current_user_id
from app.db.session import get_db
from app.models import Project
from app.models import ProjectMember
from app.models import ProjectRecruitment
from app.models import ProjectSkill
from app.models import Skill
from app.models import User
from app.models import UserSkill

router = APIRouter()


@router.post("/projects", summary="프로젝트 추천", description="로그인 사용자 스킬 기반 프로젝트를 추천합니다.")
async def recommend_projects_llm(
    payload: dict = Body(default={}),
    limit: int = Query(default=5, ge=1, le=20),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 추천 API.

    Swagger 테스트 방법:
    - Authorization 헤더에 Bearer 액세스 토큰을 설정합니다.
    - body에 `difficulty`(선택)와 `role`(선택)을 전달할 수 있습니다.
    - query `limit`(1~20)로 추천 개수를 조절합니다.

    동작:
    - 공개 프로젝트 중에서 사용자의 등록 기술과 매칭되는 프로젝트를 우선 추천합니다.
    - `role`이 주어지면 해당 포지션을 채용 중인 프로젝트로 필터링합니다.
    """
    requested_role = payload.get("role")
    preferred_difficulty = payload.get("difficulty")

    user_skill_names = [
        name for (name,) in db.query(Skill.name)
        .join(UserSkill, UserSkill.skill_id == Skill.id)
        .filter(UserSkill.user_id == current_user_id)
        .all()
    ]

    query = db.query(Project).filter(
        Project.is_public.is_(True),
        Project.deleted_at.is_(None),
    )
    if preferred_difficulty:
        query = query.filter(Project.difficulty == preferred_difficulty)

    if requested_role:
        query = query.join(ProjectRecruitment, ProjectRecruitment.project_id == Project.id).filter(
            ProjectRecruitment.position_name.ilike(f"%{requested_role}%"),
            ProjectRecruitment.status == "open",
        ).distinct()

    projects = query.all()

    scored_projects = []
    user_skill_set = {skill.lower() for skill in user_skill_names}
    for p in projects:
        project_skill_names = [
            name for (name,) in db.query(Skill.name)
            .join(ProjectSkill, ProjectSkill.skill_id == Skill.id)
            .filter(ProjectSkill.project_id == p.id)
            .all()
        ]
        project_skill_set = {skill.lower() for skill in project_skill_names}
        matched_skills = sorted(user_skill_set & project_skill_set)
        skill_match_count = len(matched_skills)

        current_members = db.query(func.count(ProjectMember.id)).filter(
            ProjectMember.project_id == p.id,
            ProjectMember.left_at.is_(None)
        ).scalar() or 0

        if skill_match_count > 0:
            reason = f"보유 기술 {skill_match_count}개가 프로젝트 요구 기술과 일치합니다."
        elif requested_role:
            reason = f"요청 포지션 '{requested_role}' 채용 프로젝트입니다."
        else:
            reason = f"{p.difficulty} 난이도와 최근 공개 프로젝트 기준 추천입니다."

        scored_projects.append({
            "project": p,
            "current_members": current_members,
            "matched_skills": matched_skills,
            "skill_match_count": skill_match_count,
            "reason": reason,
        })

    scored_projects.sort(key=lambda item: (item["skill_match_count"], item["project"].created_at), reverse=True)
    scored_projects = scored_projects[:limit]

    data = [
        {
            "project_id": item["project"].id,
            "title": item["project"].title,
            "difficulty": item["project"].difficulty,
            "currentMembers": item["current_members"],
            "maxMembers": item["project"].max_members,
            "matchedSkills": item["matched_skills"],
            "reason": item["reason"],
        }
        for item in scored_projects
    ]

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
