"""Community Forum API Endpoints"""

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id
from app.models import (
    CommunityPost,
    CommunityPostComment,
    CommunityPostReaction,
    CommunityCommentReaction,
    User,
)
from app.schemas import (
    CommentCreateRequest,
    CommentUpdateRequest,
    PostCreateRequest,
    PostUpdateRequest,
    ReactionRequest,
)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════
# ━━ Community Posts (CRUD)
# ═══════════════════════════════════════════════════════════════

@router.post("", summary="새 게시물 작성", description="커뮤니티에 새로운 게시물을 작성합니다.")
async def create_post(
    payload: PostCreateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """새로운 커뮤니티 게시물 작성"""
    post = CommunityPost(
        author_id=current_user_id,
        title=payload.title,
        content=payload.content,
        category=payload.category,
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    author = db.get(User, current_user_id)
    return success_response(
        data={
            "id": post.id,
            "author_id": post.author_id,
            "title": post.title,
            "content": post.content,
            "category": post.category,
            "is_pinned": post.is_pinned,
            "view_count": post.view_count,
            "author": {
                "id": author.id,
                "nickname": author.nickname,
                "avatar_url": author.avatar_url,
            },
            "created_at": post.created_at,
            "updated_at": post.updated_at,
        },
    )


@router.get("", summary="게시물 목록 조회", description="커뮤니티 게시물 목록을 조회합니다.")
async def list_posts(
    category: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
) -> dict:
    """게시물 목록 조회 (페이지네이션)"""
    query = db.query(CommunityPost).filter(CommunityPost.deleted_at.is_(None))

    if category:
        query = query.filter(CommunityPost.category == category)

    # 핀 된 글 먼저, 그 다음 최신순
    query = query.order_by(
        CommunityPost.is_pinned.desc(),
        CommunityPost.created_at.desc(),
    )

    total = query.count()
    posts = query.offset((page - 1) * page_size).limit(page_size).all()

    result = []
    for post in posts:
        author = db.get(User, post.author_id)
        comment_count = (
            db.query(func.count(CommunityPostComment.id))
            .filter(
                CommunityPostComment.post_id == post.id,
                CommunityPostComment.deleted_at.is_(None),
            )
            .scalar() or 0
        )

        # 반응 집계
        reactions = (
            db.query(CommunityPostReaction.reaction_type, func.count(CommunityPostReaction.id))
            .filter(CommunityPostReaction.post_id == post.id)
            .group_by(CommunityPostReaction.reaction_type)
            .all()
        )
        reaction_stats = {
            "like": 0,
            "interested": 0,
            "helpful": 0,
            "curious": 0,
        }
        for reaction_type, count in reactions:
            reaction_stats[reaction_type] = count

        result.append(
            {
                "id": post.id,
                "author_id": post.author_id,
                "title": post.title,
                "content": post.content,
                "category": post.category,
                "is_pinned": post.is_pinned,
                "view_count": post.view_count,
                "created_at": post.created_at,
                "updated_at": post.updated_at,
                "author": {
                    "id": author.id,
                    "nickname": author.nickname,
                    "avatar_url": author.avatar_url,
                },
                "comment_count": comment_count,
                "reaction_stats": reaction_stats,
            }
        )

    return success_response(
        data={
            "posts": result,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        },
    )


@router.get("/{post_id}", summary="게시물 상세 조회", description="특정 게시물의 상세 정보를 조회합니다.")
async def get_post(
    post_id: int,
    current_user_id: int | None = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """게시물 상세 조회 및 조회수 증가"""
    post = db.get(CommunityPost, post_id)
    if not post or post.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    # 조회수 증가
    post.view_count += 1
    db.commit()

    author = db.get(User, post.author_id)
    comment_count = (
        db.query(func.count(CommunityPostComment.id))
        .filter(
            CommunityPostComment.post_id == post.id,
            CommunityPostComment.deleted_at.is_(None),
        )
        .scalar() or 0
    )

    # 반응 집계 및 현재 사용자 반응
    reactions = (
        db.query(CommunityPostReaction.reaction_type, func.count(CommunityPostReaction.id))
        .filter(CommunityPostReaction.post_id == post.id)
        .group_by(CommunityPostReaction.reaction_type)
        .all()
    )
    reaction_stats = {
        "like": 0,
        "interested": 0,
        "helpful": 0,
        "curious": 0,
    }
    for reaction_type, count in reactions:
        reaction_stats[reaction_type] = count

    user_reaction = None
    if current_user_id:
        user_reaction_record = db.query(CommunityPostReaction).filter(
            CommunityPostReaction.post_id == post.id,
            CommunityPostReaction.user_id == current_user_id,
        ).first()
        if user_reaction_record:
            user_reaction = user_reaction_record.reaction_type

    return success_response(
        data={
            "id": post.id,
            "author_id": post.author_id,
            "title": post.title,
            "content": post.content,
            "category": post.category,
            "is_pinned": post.is_pinned,
            "view_count": post.view_count,
            "created_at": post.created_at,
            "updated_at": post.updated_at,
            "author": {
                "id": author.id,
                "nickname": author.nickname,
                "avatar_url": author.avatar_url,
            },
            "comment_count": comment_count,
            "reaction_stats": reaction_stats,
            "user_reaction": user_reaction,
        },
    )


@router.patch("/{post_id}", summary="게시물 수정", description="본인 게시물을 수정합니다.")
async def update_post(
    post_id: int,
    payload: PostUpdateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """게시물 수정 (작성자만)"""
    post = db.get(CommunityPost, post_id)
    if not post or post.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    if post.author_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only author can update")

    if payload.title is not None:
        post.title = payload.title
    if payload.content is not None:
        post.content = payload.content
    if payload.category is not None:
        post.category = payload.category

    db.commit()
    db.refresh(post)

    author = db.get(User, post.author_id)
    return success_response(
        data={
            "id": post.id,
            "author_id": post.author_id,
            "title": post.title,
            "content": post.content,
            "category": post.category,
            "is_pinned": post.is_pinned,
            "view_count": post.view_count,
            "created_at": post.created_at,
            "updated_at": post.updated_at,
            "author": {
                "id": author.id,
                "nickname": author.nickname,
                "avatar_url": author.avatar_url,
            },
        },
    )


@router.delete("/{post_id}", summary="게시물 삭제", description="본인 게시물을 삭제합니다.")
async def delete_post(
    post_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """게시물 소프트 삭제"""
    post = db.get(CommunityPost, post_id)
    if not post or post.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    if post.author_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only author can delete")

    post.deleted_at = func.now()
    db.commit()

    return success_response(data={"deleted": True, "post_id": post_id})


# ═══════════════════════════════════════════════════════════════
# ━━ Post Comments (CRUD)
# ═══════════════════════════════════════════════════════════════

@router.post("/{post_id}/comments", summary="댓글 작성", description="게시물에 댓글을 작성합니다.")
async def create_comment(
    post_id: int,
    payload: CommentCreateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """댓글 작성"""
    post = db.get(CommunityPost, post_id)
    if not post or post.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    comment = CommunityPostComment(
        post_id=post_id,
        author_id=current_user_id,
        content=payload.content,
        parent_comment_id=payload.parent_comment_id,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    author = db.get(User, current_user_id)
    return success_response(
        data={
            "id": comment.id,
            "post_id": comment.post_id,
            "author_id": comment.author_id,
            "content": comment.content,
            "parent_comment_id": comment.parent_comment_id,
            "created_at": comment.created_at,
            "author": {
                "id": author.id,
                "nickname": author.nickname,
                "avatar_url": author.avatar_url,
            },
        },
    )


@router.get("/{post_id}/comments", summary="댓글 목록", description="게시물의 댓글 목록을 조회합니다.")
async def list_comments(
    post_id: int,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
) -> dict:
    """댓글 목록 조회"""
    post = db.get(CommunityPost, post_id)
    if not post or post.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    query = db.query(CommunityPostComment).filter(
        CommunityPostComment.post_id == post_id,
        CommunityPostComment.deleted_at.is_(None),
        CommunityPostComment.parent_comment_id.is_(None),  # 최상위 댓글만
    )

    total = query.count()
    comments = query.order_by(CommunityPostComment.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    result = []
    for comment in comments:
        author = db.get(User, comment.author_id)
        reply_count = (
            db.query(func.count(CommunityPostComment.id))
            .filter(
                CommunityPostComment.parent_comment_id == comment.id,
                CommunityPostComment.deleted_at.is_(None),
            )
            .scalar() or 0
        )

        # 반응 집계
        reactions = (
            db.query(CommunityCommentReaction.reaction_type, func.count(CommunityCommentReaction.id))
            .filter(CommunityCommentReaction.comment_id == comment.id)
            .group_by(CommunityCommentReaction.reaction_type)
            .all()
        )
        reaction_stats = {
            "like": 0,
            "interested": 0,
            "helpful": 0,
            "curious": 0,
        }
        for reaction_type, count in reactions:
            reaction_stats[reaction_type] = count

        result.append(
            {
                "id": comment.id,
                "post_id": comment.post_id,
                "author_id": comment.author_id,
                "content": comment.content,
                "parent_comment_id": comment.parent_comment_id,
                "created_at": comment.created_at,
                "updated_at": comment.updated_at,
                "author": {
                    "id": author.id,
                    "nickname": author.nickname,
                    "avatar_url": author.avatar_url,
                },
                "reaction_stats": reaction_stats,
                "reply_count": reply_count,
            }
        )

    return success_response(
        data={
            "comments": result,
            "total": total,
            "page": page,
            "page_size": page_size,
        },
    )


@router.patch("/{post_id}/comments/{comment_id}", summary="댓글 수정", description="본인 댓글을 수정합니다.")
async def update_comment(
    post_id: int,
    comment_id: int,
    payload: CommentUpdateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """댓글 수정"""
    comment = db.get(CommunityPostComment, comment_id)
    if not comment or comment.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    if comment.author_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only author can update")

    comment.content = payload.content
    db.commit()
    db.refresh(comment)

    author = db.get(User, comment.author_id)
    return success_response(
        data={
            "id": comment.id,
            "post_id": comment.post_id,
            "author_id": comment.author_id,
            "content": comment.content,
            "created_at": comment.created_at,
            "updated_at": comment.updated_at,
            "author": {
                "id": author.id,
                "nickname": author.nickname,
                "avatar_url": author.avatar_url,
            },
        },
    )


@router.delete("/{post_id}/comments/{comment_id}", summary="댓글 삭제", description="본인 댓글을 삭제합니다.")
async def delete_comment(
    post_id: int,
    comment_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """댓글 소프트 삭제"""
    comment = db.get(CommunityPostComment, comment_id)
    if not comment or comment.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    if comment.author_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only author can delete")

    comment.deleted_at = func.now()
    db.commit()

    return success_response(data={"deleted": True, "comment_id": comment_id})


# ═══════════════════════════════════════════════════════════════
# ━━ Reactions
# ═══════════════════════════════════════════════════════════════

@router.post("/{post_id}/reactions", summary="게시물에 반응 추가", description="게시물에 좋아요/관심있어요 등을 표현합니다.")
async def add_post_reaction(
    post_id: int,
    payload: ReactionRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """게시물 반응 추가/토글"""
    post = db.get(CommunityPost, post_id)
    if not post or post.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    existing = db.query(CommunityPostReaction).filter(
        CommunityPostReaction.post_id == post_id,
        CommunityPostReaction.user_id == current_user_id,
        CommunityPostReaction.reaction_type == payload.reaction_type,
    ).first()

    if existing:
        # 이미 있으면 제거
        db.delete(existing)
        db.commit()
        return success_response(data={"action": "removed", "reaction_type": payload.reaction_type})
    else:
        # 기존 다른 반응 제거 후 새 반응 추가
        old_reactions = db.query(CommunityPostReaction).filter(
            CommunityPostReaction.post_id == post_id,
            CommunityPostReaction.user_id == current_user_id,
        ).all()
        for r in old_reactions:
            db.delete(r)

        reaction = CommunityPostReaction(
            post_id=post_id,
            user_id=current_user_id,
            reaction_type=payload.reaction_type,
        )
        db.add(reaction)
        db.commit()
        return success_response(data={"action": "added", "reaction_type": payload.reaction_type})


@router.post("/{post_id}/comments/{comment_id}/reactions", summary="댓글에 반응 추가", description="댓글에 좋아요/관심있어요 등을 표현합니다.")
async def add_comment_reaction(
    post_id: int,
    comment_id: int,
    payload: ReactionRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """댓글 반응 추가/토글"""
    comment = db.get(CommunityPostComment, comment_id)
    if not comment or comment.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    existing = db.query(CommunityCommentReaction).filter(
        CommunityCommentReaction.comment_id == comment_id,
        CommunityCommentReaction.user_id == current_user_id,
        CommunityCommentReaction.reaction_type == payload.reaction_type,
    ).first()

    if existing:
        # 이미 있으면 제거
        db.delete(existing)
        db.commit()
        return success_response(data={"action": "removed", "reaction_type": payload.reaction_type})
    else:
        # 기존 다른 반응 제거 후 새 반응 추가
        old_reactions = db.query(CommunityCommentReaction).filter(
            CommunityCommentReaction.comment_id == comment_id,
            CommunityCommentReaction.user_id == current_user_id,
        ).all()
        for r in old_reactions:
            db.delete(r)

        reaction = CommunityCommentReaction(
            comment_id=comment_id,
            user_id=current_user_id,
            reaction_type=payload.reaction_type,
        )
        db.add(reaction)
        db.commit()
        return success_response(data={"action": "added", "reaction_type": payload.reaction_type})
