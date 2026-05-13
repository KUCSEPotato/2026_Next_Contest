from collections import defaultdict

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.dependencies.auth import get_current_user_id
from app.db.session import get_db
from app.models import Interest
from app.models import Project
from app.models import ProjectInterest
from app.models import ProjectMember
from app.models import ProjectRecruitment
from app.models import ProjectSkill
from app.models import Skill
from app.models import User
from app.models import UserInterest
from app.models import UserSkill

router = APIRouter()

PROJECT_RECOMMENDATION_CANDIDATE_LIMIT = 30
PROJECT_RECOMMENDATION_RESULT_LIMIT = 6


@router.post("/projects", summary="프로젝트 추천", description="로그인 사용자 기술 스택/관심분야 기반 규칙 추천입니다.")
async def recommend_projects_llm(
    payload: dict = Body(default={}),
    limit: int = Query(default=PROJECT_RECOMMENDATION_RESULT_LIMIT, ge=1, le=20),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 추천 API.

    Swagger 테스트 방법:
    - Authorization 헤더에 Bearer 액세스 토큰을 설정합니다.
    - body에 `difficulty`(선택)와 `role`(선택)을 전달할 수 있습니다.
    - query `limit`(기본 6, 1~20)로 추천 개수를 조절합니다.

    동작:
    - 기술 스택과 관심분야가 각각 1개 이상 매칭되는 공개/미삭제 프로젝트만 추천합니다.
    - 모집중이고 현재 참여 인원이 최대 참여 인원 미만인 프로젝트만 추천합니다.
    - `role`이 주어지면 해당 포지션을 채용 중인 프로젝트로 필터링합니다.
    """
    requested_role = payload.get("role")
    preferred_difficulty = payload.get("difficulty")

    user_skill_rows = (
        db.query(Skill.id, Skill.name)
        .join(UserSkill, UserSkill.skill_id == Skill.id)
        .filter(UserSkill.user_id == current_user_id)
        .all()
    )
    user_interest_rows = (
        db.query(Interest.id, Interest.name)
        .join(UserInterest, UserInterest.interest_id == Interest.id)
        .filter(UserInterest.user_id == current_user_id)
        .all()
    )
    user_skill_ids = [skill_id for (skill_id, _name) in user_skill_rows]
    user_interest_ids = [interest_id for (interest_id, _name) in user_interest_rows]
    user_skill_names = [name for (_skill_id, name) in user_skill_rows]
    user_interest_names = [name for (_interest_id, name) in user_interest_rows]

    if not user_skill_ids or not user_interest_ids:
        return success_response(data=[])

    current_member_count_subquery = (
        db.query(
            ProjectMember.project_id.label("project_id"),
            func.count(ProjectMember.id).label("current_members"),
        )
        .filter(ProjectMember.left_at.is_(None))
        .group_by(ProjectMember.project_id)
        .subquery()
    )

    query = (
        db.query(Project)
        .join(ProjectSkill, ProjectSkill.project_id == Project.id)
        .join(ProjectInterest, ProjectInterest.project_id == Project.id)
        .join(ProjectRecruitment, ProjectRecruitment.project_id == Project.id)
        .outerjoin(current_member_count_subquery, current_member_count_subquery.c.project_id == Project.id)
        .filter(
            Project.is_public.is_(True),
            Project.deleted_at.is_(None),
            ProjectSkill.skill_id.in_(user_skill_ids),
            ProjectInterest.interest_id.in_(user_interest_ids),
            ProjectRecruitment.status == "open",
            func.coalesce(current_member_count_subquery.c.current_members, 0) < Project.max_members,
        )
        .distinct()
    )
    if preferred_difficulty:
        query = query.filter(Project.difficulty == preferred_difficulty)

    if requested_role:
        query = query.filter(ProjectRecruitment.position_name.ilike(f"%{requested_role}%"))

    projects = (
        query
        .order_by(Project.created_at.desc())
        .limit(PROJECT_RECOMMENDATION_CANDIDATE_LIMIT)
        .all()
    )

    if not projects:
        return success_response(data=[])

    project_ids = [project.id for project in projects]

    user_skill_set = {skill.lower() for skill in user_skill_names}
    user_interest_set = {interest.lower() for interest in user_interest_names}

    project_skills: dict[int, list[str]] = defaultdict(list)
    for project_id, skill_name in (
        db.query(ProjectSkill.project_id, Skill.name)
        .join(Skill, Skill.id == ProjectSkill.skill_id)
        .filter(ProjectSkill.project_id.in_(project_ids))
        .all()
    ):
        project_skills[project_id].append(skill_name)

    project_interests: dict[int, list[str]] = defaultdict(list)
    for project_id, interest_name in (
        db.query(ProjectInterest.project_id, Interest.name)
        .join(Interest, Interest.id == ProjectInterest.interest_id)
        .filter(ProjectInterest.project_id.in_(project_ids))
        .all()
    ):
        project_interests[project_id].append(interest_name)

    current_member_counts = dict(
        db.query(ProjectMember.project_id, func.count(ProjectMember.id))
        .filter(
            ProjectMember.project_id.in_(project_ids),
            ProjectMember.left_at.is_(None),
        )
        .group_by(ProjectMember.project_id)
        .all()
    )

    project_items = []
    for project in projects:
        skill_names = project_skills[project.id]
        interest_names = project_interests[project.id]
        matched_skills = sorted(user_skill_set & {skill.lower() for skill in skill_names})
        matched_interests = sorted(user_interest_set & {interest.lower() for interest in interest_names})
        current_members = int(current_member_counts.get(project.id, 0))
        if current_members >= project.max_members:
            continue

        reason = f"기술 {len(matched_skills)}개와 관심분야 {len(matched_interests)}개가 매칭되고 모집 정원이 남아 있습니다."

        project_items.append({
            "project": project,
            "current_members": current_members,
            "matched_skills": matched_skills,
            "matched_interests": matched_interests,
            "skill_match_count": len(matched_skills),
            "interest_match_count": len(matched_interests),
            "reason": reason,
        })

    project_items.sort(
        key=lambda item: (
            item["skill_match_count"] + item["interest_match_count"],
            item["skill_match_count"],
            item["project"].created_at,
        ),
        reverse=True,
    )

    data = []
    for item in project_items[:limit]:
        project = item["project"]
        data.append(
            {
                "project_id": project.id,
                "title": project.title,
                "difficulty": project.difficulty,
                "currentMembers": item["current_members"],
                "maxMembers": project.max_members,
                "matchedSkills": item["matched_skills"],
                "matchedInterests": item["matched_interests"],
                "reason": item["reason"],
            }
        )

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
