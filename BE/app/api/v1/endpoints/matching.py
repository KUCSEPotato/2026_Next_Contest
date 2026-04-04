from fastapi import APIRouter
from fastapi import Depends, Query
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.db.session import get_db
from app.models import Project
from app.models import User

router = APIRouter()


@router.get("/recommend-candidates", summary="추천 인재 조회", description="활성 사용자 중 추천 후보를 조회합니다.")
async def recommend_candidates(
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
) -> dict:
    """추천 인재 조회 API.

    Swagger 테스트 방법:
    - query parameter `limit`로 반환 개수를 조절합니다.
    """
    users = db.query(User).filter(User.is_active.is_(True)).order_by(User.created_at.desc()).limit(limit).all()
    return success_response(data=[{"id": u.id, "nickname": u.nickname, "role": u.role} for u in users])


@router.get("/recommend-projects", summary="추천 프로젝트 조회", description="공개 프로젝트 중 추천 후보를 조회합니다.")
async def recommend_projects(
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
) -> dict:
    """추천 프로젝트 조회 API.

    Swagger 테스트 방법:
    - query `limit`(1~50)로 반환 개수를 설정합니다.

    동작:
    - 공개 프로젝트를 최신순으로 조회해 추천 후보를 반환합니다.
    """
    projects = db.query(Project).filter(Project.is_public.is_(True)).order_by(Project.created_at.desc()).limit(limit).all()
    return success_response(
        data=[
            {"id": p.id, "title": p.title, "difficulty": p.difficulty, "status": p.status}
            for p in projects
        ]
    )
