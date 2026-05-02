from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id
from app.models import Idea
from app.models import IdeaBookmark
from app.models import IdeaLike
from app.schemas import IdeaCreateRequest
from app.schemas import IdeaUpdateRequest

router = APIRouter()


@router.post("", summary="아이디어 생성", description="새로운 프로젝트 아이디어를 등록합니다.")
async def create_idea(
    payload: IdeaCreateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """아이디어 생성 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.
    - body에 제목/설명/난이도를 포함해 호출합니다.
    """
    idea = Idea(
        author_id=current_user_id,
        title=payload.title,
        summary=payload.summary,
        description=payload.description,
        domain=payload.domain,
        tech_stack=payload.tech_stack,
        hashtags=payload.hashtags,
        difficulty=payload.difficulty,
        required_members=payload.required_members,
        is_open=payload.is_open,
    )
    db.add(idea)
    db.commit()
    db.refresh(idea)
    return success_response(data={"id": idea.id, "title": idea.title})


@router.get("", summary="아이디어 목록", description="페이지네이션과 난이도 필터를 지원하는 아이디어 목록 조회 API입니다.")
async def list_ideas(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    difficulty: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    """아이디어 목록 조회 API.

    Swagger 테스트 방법:
    - query `page`, `size`, `difficulty`를 조합해 호출합니다.

    응답:
    - data에 아이디어 목록, meta에 page/size/total을 반환합니다.
    """
    query = db.query(Idea)
    query = query.filter(Idea.deleted_at.is_(None))
    if difficulty:
        query = query.filter(Idea.difficulty == difficulty)

    total = query.count()
    ideas = query.order_by(Idea.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return success_response(
        data=[
            {
                "id": idea.id,
                "title": idea.title,
                "summary": idea.summary,
                "tech_stack": idea.tech_stack,
                "hashtags": idea.hashtags,
                "difficulty": idea.difficulty,
                "is_open": idea.is_open,
                "created_at": idea.created_at,
            }
            for idea in ideas
        ],
        meta={"page": page, "size": size, "total": total},
    )


@router.get("/{idea_id}", summary="아이디어 상세", description="아이디어 상세 정보를 조회합니다.")
async def get_idea(idea_id: int, db: Session = Depends(get_db)) -> dict:
    """아이디어 상세 조회 API.

    Swagger 테스트 방법:
    - path의 `idea_id`를 전달합니다.

    검증:
    - 아이디어가 없거나 삭제 상태면 `404`를 반환합니다.
    """
    idea = db.get(Idea, idea_id)
    if idea is None or idea.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found")
    return success_response(
        data={
            "id": idea.id,
            "author_id": idea.author_id,
            "title": idea.title,
            "summary": idea.summary,
            "description": idea.description,
            "domain": idea.domain,
            "tech_stack": idea.tech_stack,
            "hashtags": idea.hashtags,
            "difficulty": idea.difficulty,
            "required_members": idea.required_members,
            "is_open": idea.is_open,
        },
    )


@router.patch("/{idea_id}", summary="아이디어 수정", description="작성자 본인이 아이디어 필드를 부분 수정합니다.")
async def update_idea(
    idea_id: int,
    payload: IdeaUpdateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """아이디어 수정 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.
    - body에 수정할 필드만 전달하는 partial update 방식입니다.

    권한/검증:
    - 작성자만 수정할 수 있으며 아니면 `403`을 반환합니다.
    """
    idea = db.get(Idea, idea_id)
    if idea is None or idea.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found")
    if idea.author_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only author can update")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(idea, field, value)
    db.commit()
    db.refresh(idea)
    return success_response(data={"id": idea.id, "updated": True})


@router.delete("/{idea_id}", summary="아이디어 삭제", description="작성자 본인이 아이디어를 soft delete 합니다.")
async def delete_idea(
    idea_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """아이디어 삭제 API(soft delete).

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.

    권한/검증:
    - 작성자만 삭제 가능
    - 실제 row 삭제 대신 deleted_at을 기록합니다.
    """
    idea = db.get(Idea, idea_id)
    if idea is None or idea.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found")
    if idea.author_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only author can delete")
    idea.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return success_response(data={"deleted": True, "id": idea_id})


@router.post("/{idea_id}/bookmark", summary="아이디어 북마크", description="아이디어를 북마크 목록에 추가합니다.")
async def bookmark_idea(
    idea_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """아이디어 북마크 추가 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.

    검증:
    - 대상 아이디어가 없으면 `404`
    - 이미 북마크된 경우 `409`
    """
    idea = db.get(Idea, idea_id)
    if idea is None or idea.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found")
    if db.query(IdeaBookmark).filter(IdeaBookmark.user_id == current_user_id, IdeaBookmark.idea_id == idea_id).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already bookmarked")
    bookmark = IdeaBookmark(user_id=current_user_id, idea_id=idea_id)
    db.add(bookmark)
    db.commit()
    return success_response(data={"bookmarked": True, "idea_id": idea_id})


@router.delete("/{idea_id}/bookmark", summary="아이디어 북마크 해제", description="아이디어 북마크를 해제합니다.")
async def unbookmark_idea(
    idea_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """아이디어 북마크 해제 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.

    검증:
    - 북마크 매핑이 없으면 `404`
    """
    bookmark = db.query(IdeaBookmark).filter(IdeaBookmark.user_id == current_user_id, IdeaBookmark.idea_id == idea_id).first()
    if bookmark is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bookmark not found")
    db.delete(bookmark)
    db.commit()
    return success_response(data={"bookmarked": False, "idea_id": idea_id})


@router.post("/{idea_id}/like", summary="아이디어 좋아요", description="아이디어에 좋아요를 추가합니다.")
async def like_idea(
    idea_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """아이디어 좋아요 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.

    검증:
    - 아이디어가 없으면 `404`
    - 이미 좋아요한 경우 `409`
    """
    idea = db.get(Idea, idea_id)
    if idea is None or idea.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found")
    if db.query(IdeaLike).filter(IdeaLike.user_id == current_user_id, IdeaLike.idea_id == idea_id).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already liked")
    like = IdeaLike(user_id=current_user_id, idea_id=idea_id)
    db.add(like)
    db.commit()
    return success_response(data={"liked": True, "idea_id": idea_id})


@router.delete("/{idea_id}/like", summary="아이디어 좋아요 취소", description="아이디어 좋아요를 취소합니다.")
async def unlike_idea(
    idea_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """아이디어 좋아요 취소 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.

    검증:
    - 좋아요 매핑이 없으면 `404`
    """
    like = db.query(IdeaLike).filter(IdeaLike.user_id == current_user_id, IdeaLike.idea_id == idea_id).first()
    if like is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Like not found")
    db.delete(like)
    db.commit()
    return success_response(data={"liked": False, "idea_id": idea_id})
