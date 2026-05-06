from fastapi import APIRouter
from fastapi import Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.db.session import get_db
from app.models import Idea
from app.models import Project
from app.models import ProjectMember
from app.models import Skill
from app.models import User

router = APIRouter()


@router.get("/projects", summary="프로젝트 검색", description="키워드 기반 프로젝트 검색을 수행합니다.")
async def search_projects(
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 검색 API.

    Swagger 테스트 방법:
    - query `q`에 검색 키워드를 전달합니다.

    동작:
    - title/description에 대해 부분 일치 검색을 수행합니다.
    - 최대 50건을 최신순으로 반환합니다.
    """
    query = db.query(Project)
    if q:
        keyword = f"%{q}%"
        query = query.filter((Project.title.ilike(keyword)) | (Project.description.ilike(keyword)))
    projects = query.order_by(Project.created_at.desc()).limit(50).all()
    
    data = []
    for p in projects:
        current_members = db.query(func.count(ProjectMember.id)).filter(
            ProjectMember.project_id == p.id,
            ProjectMember.left_at.is_(None)
        ).scalar() or 0
        data.append({
            "id": p.id,
            "title": p.title,
            "status": p.status,
            "difficulty": p.difficulty,
            "currentMembers": current_members,
            "maxMembers": p.max_members,
        })
    
    return success_response(data=data)


@router.get("/ideas", summary="아이디어 검색", description="키워드 기반 아이디어 검색을 수행합니다.")
async def search_ideas(
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    """아이디어 검색 API.

    Swagger 테스트 방법:
    - query `q`로 제목/설명 키워드 검색을 수행합니다.
    """
    query = db.query(Idea)
    query = query.filter(Idea.deleted_at.is_(None))
    if q:
        keyword = f"%{q}%"
        query = query.filter((Idea.title.ilike(keyword)) | (Idea.description.ilike(keyword)))
    ideas = query.order_by(Idea.created_at.desc()).limit(50).all()
    return success_response(
        data=[
            {
                "id": i.id,
                "title": i.title,
                "difficulty": i.difficulty,
                "tech_stack": i.tech_stack,
                "hashtags": i.hashtags,
            }
            for i in ideas
        ]
    )


@router.get("/users", summary="사용자 검색", description="닉네임/소개 기반 사용자 검색을 수행합니다.")
async def search_users(
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    """사용자 검색 API.

    Swagger 테스트 방법:
    - query `q`로 닉네임/소개 필드를 검색합니다.
    - 최대 50건을 반환합니다.
    """
    query = db.query(User)
    if q:
        keyword = f"%{q}%"
        query = query.filter((User.nickname.ilike(keyword)) | (User.bio.ilike(keyword)))
    users = query.order_by(User.created_at.desc()).limit(50).all()
    return success_response(data=[{"id": u.id, "nickname": u.nickname, "bio": u.bio} for u in users])


@router.get("/tags", summary="태그 자동완성", description="입력 prefix 기반 기술 태그 자동완성을 제공합니다.")
async def autocomplete_tags(
    q: str = Query(default=""),
    db: Session = Depends(get_db),
) -> dict:
    """태그 자동완성 API.

    Swagger 테스트 방법:
    - query `q`에 prefix를 전달합니다.
    - Skill.normalized_name 기준으로 최대 20개 후보를 반환합니다.
    """
    keyword = f"{q.lower()}%"
    skills = db.query(Skill).filter(Skill.normalized_name.ilike(keyword)).order_by(Skill.normalized_name.asc()).limit(20).all()
    return success_response(data=[s.name for s in skills])
