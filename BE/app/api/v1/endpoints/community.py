"""Community Forum API Endpoints"""

from fastapi import APIRouter, Body, Depends, HTTPException, status, Header, File, UploadFile
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id, get_current_user_id_from_token
from app.models import (
    CommunityPost,
    CommunityPostComment,
    CommunityPostReaction,
    CommunityCommentReaction,
    CommunityPostFile,
    Notification,
    User,
)
from app.schemas import (
    CommentCreateRequest,
    CommentUpdateRequest,
    PostCreateRequest,
    PostUpdateRequest,
    ReactionRequest,
)
from app.services.s3_upload import get_s3_service
from app.services.economy import spend_coins

router = APIRouter()

_REACTION_STATS_ZERO: dict[str, int] = {"recommend": 0, "not_recommend": 0}


def _merge_reaction_stats(rows: list[tuple[str, int]]) -> dict[str, int]:
    stats = dict(_REACTION_STATS_ZERO)
    for reaction_type, count in rows:
        if reaction_type in stats:
            stats[reaction_type] = count
    return stats


def _post_reaction_snapshot(db: Session, post_id: int, user_id: int | None = None) -> dict:
    reactions = (
        db.query(CommunityPostReaction.reaction_type, func.count(CommunityPostReaction.id))
        .filter(CommunityPostReaction.post_id == post_id)
        .group_by(CommunityPostReaction.reaction_type)
        .all()
    )
    user_reaction = None
    if user_id:
        user_reaction_record = db.query(CommunityPostReaction).filter(
            CommunityPostReaction.post_id == post_id,
            CommunityPostReaction.user_id == user_id,
        ).first()
        if user_reaction_record:
            user_reaction = user_reaction_record.reaction_type
    return {
        "reaction_stats": _merge_reaction_stats(reactions),
        "user_reaction": user_reaction,
    }


def _comment_reaction_snapshot(db: Session, comment_id: int, user_id: int | None = None) -> dict:
    reactions = (
        db.query(CommunityCommentReaction.reaction_type, func.count(CommunityCommentReaction.id))
        .filter(CommunityCommentReaction.comment_id == comment_id)
        .group_by(CommunityCommentReaction.reaction_type)
        .all()
    )
    user_reaction = None
    if user_id:
        user_reaction_record = db.query(CommunityCommentReaction).filter(
            CommunityCommentReaction.comment_id == comment_id,
            CommunityCommentReaction.user_id == user_id,
        ).first()
        if user_reaction_record:
            user_reaction = user_reaction_record.reaction_type
    return {
        "reaction_stats": _merge_reaction_stats(reactions),
        "user_reaction": user_reaction,
    }


def _serialize_comment(db: Session, comment: CommunityPostComment, current_user_id: int | None = None) -> dict:
    author = db.get(User, comment.author_id)
    reply_count = (
        db.query(func.count(CommunityPostComment.id))
        .filter(
            CommunityPostComment.parent_comment_id == comment.id,
            CommunityPostComment.deleted_at.is_(None),
        )
        .scalar() or 0
    )
    anon = comment.is_anonymous
    snapshot = _comment_reaction_snapshot(db, comment.id, current_user_id)
    return {
        "id": comment.id,
        "post_id": comment.post_id,
        "author_id": comment.author_id if not anon else None,
        "content": comment.content,
        "parent_comment_id": comment.parent_comment_id,
        "is_anonymous": anon,
        "is_mine": bool(current_user_id and comment.author_id == current_user_id),
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
            "author": {
                "id": author.id if not anon else None,
                "nickname": "익명" if anon else author.nickname,
                "avatar_url": None if anon else author.avatar_url,
                "role": None if anon else author.role,
            },
        "reaction_stats": snapshot["reaction_stats"],
        "user_reaction": snapshot["user_reaction"],
        "reply_count": reply_count,
    }


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
    # Restrict certain categories to admin only
    if payload.category in ("announcement", "event"):
        user = db.get(User, current_user_id)
        if user is None or user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can create announcement or event posts")
    post = CommunityPost(
        author_id=current_user_id,
        title=payload.title,
        content=payload.content,
        category=payload.category,
    )
    db.add(post)
    db.flush()
    if payload.category not in ("announcement", "event"):
        spend_coins(
            db,
            user_id=current_user_id,
            amount=1,
            event_type="waterdrop.community.write",
            source_type="community_post",
            source_id=post.id,
            note=f"Community post waterdrop for {post.title}",
        )
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
                "role": author.role,
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
    sort_by: str = "newest",
    exclude_admin_categories: bool = False,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> dict:
    """게시물 목록 조회 (페이지네이션)
    
    sort_by 옵션:
    - newest (기본값): 최신순 (created_at desc)
    - views: 조회수 높은 순 (view_count desc)
    - likes / recommend: 추천 많은 순 (likes는 recommend와 동일)
    - comments: 댓글 많은 순
    - trending/hot: 핫게 (조회수*0.1 + 추천*1.0 + 댓글*0.5)
    """
    query = db.query(CommunityPost).filter(CommunityPost.deleted_at.is_(None))

    if category:
        query = query.filter(CommunityPost.category == category)
    elif exclude_admin_categories:
        query = query.filter(CommunityPost.category.notin_(("announcement", "event")))

    # sort_by에 따른 초기 정렬 설정 (핀 된 글은 항상 먼저)
    if sort_by == "views":
        query = query.order_by(
            CommunityPost.view_count.desc(),
            CommunityPost.created_at.desc(),
        )
    elif sort_by in ["likes", "recommend", "comments", "trending", "hot"]:
        # likes/recommend, comments, trending은 메모리에서 정렬하므로 일단 핀만 먼저
        query = query.order_by(CommunityPost.created_at.desc())
    else:  # newest (기본값)
        query = query.order_by(
            CommunityPost.is_pinned.desc(),
            CommunityPost.created_at.desc(),
        )

    total = query.count()
    
    # 페이지네이션 전에 정렬 (likes, comments, trending은 메모리 정렬이므로)
    if sort_by in ["likes", "recommend", "comments", "trending", "hot"]:
        posts = query.all()  # 모든 데이터를 먼저 가져옴
    else:
        posts = query.offset((page - 1) * page_size).limit(page_size).all()

    result = []
    # determine current user id if Authorization header provided
    current_user_id: int | None = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        try:
            current_user_id = get_current_user_id_from_token(token)
        except HTTPException:
            current_user_id = None
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
        reaction_stats = _merge_reaction_stats(reactions)

        # determine user's reaction if logged in
        user_reaction = None
        if current_user_id:
            user_reaction_record = db.query(CommunityPostReaction).filter(
                CommunityPostReaction.post_id == post.id,
                CommunityPostReaction.user_id == current_user_id,
            ).first()
            if user_reaction_record:
                user_reaction = user_reaction_record.reaction_type

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
                    "role": author.role,
                },
                "comment_count": comment_count,
                "reaction_stats": reaction_stats,
                "user_reaction": user_reaction,
            }
        )

    # 메모리에서 정렬 (likes/recommend, comments, trending은 계산된 값이므로)
    if sort_by in ("likes", "recommend"):
        # 추천순으로 정렬 (핀 된 글 우선 유지)
        result.sort(
            key=lambda x: (x["reaction_stats"]["recommend"], x["created_at"]),
            reverse=True,
        )
    elif sort_by == "comments":
        # 댓글순으로 정렬 (핀 된 글 우선 유지)
        result.sort(key=lambda x: (x["comment_count"], x["created_at"]), reverse=True)
    elif sort_by in ["trending", "hot"]:
        # 핫게 정렬: 조회수*0.1 + 추천 수*1.0 + 댓글*0.5
        def calculate_trending_score(post):
            return (
                post["view_count"] * 0.1 +
                post["reaction_stats"]["recommend"] * 1.0 +
                post["comment_count"] * 0.5
            )
        
        result.sort(
            key=lambda x: (calculate_trending_score(x), x["created_at"]),
            reverse=True,
        )

    # 페이지네이션 적용 (likes, comments, trending은 이제 정렬이 완료됨)
    if sort_by in ["likes", "recommend", "comments", "trending", "hot"]:
        paginated_result = result[(page - 1) * page_size : page * page_size]
    else:
        paginated_result = result

    return success_response(
        data={
            "posts": paginated_result,
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
    reaction_stats = _merge_reaction_stats(reactions)

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
                "role": author.role,
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
    comment_count = (
        db.query(func.count(CommunityPostComment.id))
        .filter(
            CommunityPostComment.post_id == post.id,
            CommunityPostComment.deleted_at.is_(None),
        )
        .scalar() or 0
    )
    snapshot = _post_reaction_snapshot(db, post.id, current_user_id)
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
                "role": author.role,
            },
            "comment_count": comment_count,
            "reaction_stats": snapshot["reaction_stats"],
            "user_reaction": snapshot["user_reaction"],
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

    if payload.parent_comment_id is not None:
        parent = db.get(CommunityPostComment, payload.parent_comment_id)
        if (
            parent is None
            or parent.post_id != post_id
            or parent.parent_comment_id is not None
            or parent.deleted_at is not None
        ):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid parent comment")

    comment = CommunityPostComment(
        post_id=post_id,
        author_id=current_user_id,
        content=payload.content,
        parent_comment_id=payload.parent_comment_id,
        is_anonymous=payload.is_anonymous,
    )
    db.add(comment)
    db.flush()
    if post.author_id != current_user_id:
        db.add(
            Notification(
                user_id=post.author_id,
                type="system",
                title="게시글에 새 댓글이 달렸습니다",
                body=f"'{post.title}' 게시글에 새 댓글이 달렸습니다.",
                data={
                    "post_id": post_id,
                    "comment_id": comment.id,
                    "url": f"/community/{post_id}",
                },
            )
        )
    db.commit()
    db.refresh(comment)

    author = db.get(User, current_user_id)
    # 익명인 경우 작성자 정보 숨김
    author_info = {
        "id": author.id if not payload.is_anonymous else None,
        "nickname": "익명" if payload.is_anonymous else author.nickname,
        "avatar_url": None if payload.is_anonymous else author.avatar_url,
        "role": None if payload.is_anonymous else author.role,
    }
    
    return success_response(
        data={
            "id": comment.id,
            "post_id": comment.post_id,
            "author_id": comment.author_id if not payload.is_anonymous else None,
            "content": comment.content,
            "parent_comment_id": comment.parent_comment_id,
            "is_anonymous": comment.is_anonymous,
            "is_mine": True,
            "created_at": comment.created_at,
            "updated_at": comment.updated_at,
            "author": author_info,
            "reaction_stats": dict(_REACTION_STATS_ZERO),
            "user_reaction": None,
            "reply_count": 0,
        },
    )


@router.get("/{post_id}/comments", summary="댓글 목록", description="게시물의 댓글 목록을 조회합니다.")
async def list_comments(
    post_id: int,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> dict:
    """댓글 목록 조회"""
    post = db.get(CommunityPost, post_id)
    if not post or post.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    current_user_id: int | None = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        try:
            current_user_id = get_current_user_id_from_token(token)
        except HTTPException:
            current_user_id = None

    root_query = db.query(CommunityPostComment).filter(
        CommunityPostComment.post_id == post_id,
        CommunityPostComment.deleted_at.is_(None),
        CommunityPostComment.parent_comment_id.is_(None),  # 최상위 댓글만
    )

    total = root_query.count()
    root_comments = (
        root_query.order_by(CommunityPostComment.created_at.asc(), CommunityPostComment.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    root_ids = [comment.id for comment in root_comments]
    if root_ids:
        comments = (
            db.query(CommunityPostComment)
            .filter(
                CommunityPostComment.post_id == post_id,
                CommunityPostComment.deleted_at.is_(None),
                (
                    CommunityPostComment.id.in_(root_ids)
                    | CommunityPostComment.parent_comment_id.in_(root_ids)
                ),
            )
            .order_by(CommunityPostComment.created_at.asc(), CommunityPostComment.id.asc())
            .all()
        )
    else:
        comments = []

    result = []
    for comment in comments:
        result.append(_serialize_comment(db, comment, current_user_id))
        continue
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
        reaction_stats = _merge_reaction_stats(reactions)

        is_mine = bool(current_user_id and comment.author_id == current_user_id)

        result.append(
            {
                "id": comment.id,
                "post_id": comment.post_id,
                "author_id": comment.author_id if not comment.is_anonymous else None,
                "content": comment.content,
                "parent_comment_id": comment.parent_comment_id,
                "is_anonymous": comment.is_anonymous,
                "is_mine": is_mine,
                "created_at": comment.created_at,
                "updated_at": comment.updated_at,
                "author": {
                    "id": author.id if not comment.is_anonymous else None,
                    "nickname": "익명" if comment.is_anonymous else author.nickname,
                    "avatar_url": None if comment.is_anonymous else author.avatar_url,
                    "role": None if comment.is_anonymous else author.role,
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
    anon = comment.is_anonymous
    return success_response(
        data={
            "id": comment.id,
            "post_id": comment.post_id,
            "author_id": comment.author_id if not anon else None,
            "content": comment.content,
            "parent_comment_id": comment.parent_comment_id,
            "is_anonymous": anon,
            "is_mine": True,
            "created_at": comment.created_at,
            "updated_at": comment.updated_at,
            "author": {
                "id": author.id if not anon else None,
                "nickname": "익명" if anon else author.nickname,
                "avatar_url": None if anon else author.avatar_url,
                "role": None if anon else author.role,
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

@router.post("/{post_id}/reactions", summary="게시물에 반응 추가", description="게시물에 추천 또는 비추천을 표현합니다.")
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
    ).first()

    if existing:
        if existing.reaction_type == payload.reaction_type:
            db.delete(existing)
            db.commit()
            return success_response(data={
                "action": "removed",
                "reaction_type": payload.reaction_type,
                **_post_reaction_snapshot(db, post_id, current_user_id),
            })

        existing.reaction_type = payload.reaction_type
        db.commit()
        return success_response(data={
            "action": "updated",
            "reaction_type": payload.reaction_type,
            **_post_reaction_snapshot(db, post_id, current_user_id),
        })

    reaction = CommunityPostReaction(
        post_id=post_id,
        user_id=current_user_id,
        reaction_type=payload.reaction_type,
    )
    db.add(reaction)
    try:
        db.commit()
        return success_response(data={
            "action": "added",
            "reaction_type": payload.reaction_type,
            **_post_reaction_snapshot(db, post_id, current_user_id),
        })
    except IntegrityError:
        db.rollback()
        existing = db.query(CommunityPostReaction).filter(
            CommunityPostReaction.post_id == post_id,
            CommunityPostReaction.user_id == current_user_id,
        ).first()
        if existing is None:
            raise
        existing.reaction_type = payload.reaction_type
        db.commit()
        return success_response(data={
            "action": "updated",
            "reaction_type": payload.reaction_type,
            **_post_reaction_snapshot(db, post_id, current_user_id),
        })


@router.post("/{post_id}/comments/{comment_id}/reactions", summary="댓글에 반응 추가", description="댓글에 추천 또는 비추천을 표현합니다.")
async def add_comment_reaction(
    post_id: int,
    comment_id: int,
    payload: ReactionRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """댓글 반응 추가/토글"""
    comment = db.get(CommunityPostComment, comment_id)
    if not comment or comment.post_id != post_id or comment.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    existing = db.query(CommunityCommentReaction).filter(
        CommunityCommentReaction.comment_id == comment_id,
        CommunityCommentReaction.user_id == current_user_id,
    ).first()

    if existing:
        if existing.reaction_type == payload.reaction_type:
            db.delete(existing)
            db.commit()
            return success_response(data={
                "action": "removed",
                "reaction_type": payload.reaction_type,
                **_comment_reaction_snapshot(db, comment_id, current_user_id),
            })

        existing.reaction_type = payload.reaction_type
        db.commit()
        return success_response(data={
            "action": "updated",
            "reaction_type": payload.reaction_type,
            **_comment_reaction_snapshot(db, comment_id, current_user_id),
        })

    reaction = CommunityCommentReaction(
        comment_id=comment_id,
        user_id=current_user_id,
        reaction_type=payload.reaction_type,
    )
    db.add(reaction)
    try:
        db.commit()
        return success_response(data={
            "action": "added",
            "reaction_type": payload.reaction_type,
            **_comment_reaction_snapshot(db, comment_id, current_user_id),
        })
    except IntegrityError:
        db.rollback()
        existing = db.query(CommunityCommentReaction).filter(
            CommunityCommentReaction.comment_id == comment_id,
            CommunityCommentReaction.user_id == current_user_id,
        ).first()
        if existing is None:
            raise
        existing.reaction_type = payload.reaction_type
        db.commit()
        return success_response(data={
            "action": "updated",
            "reaction_type": payload.reaction_type,
            **_comment_reaction_snapshot(db, comment_id, current_user_id),
        })


# ═══════════════════════════════════════════════════════════════
# ━━ File Upload
# ═══════════════════════════════════════════════════════════════

@router.post("/{post_id}/files", summary="게시물에 파일 첨부", description="게시물에 파일을 업로드합니다. 최대 50MB.")
async def upload_post_file(
    post_id: int,
    file: UploadFile = File(...),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
    s3_service=Depends(get_s3_service),
) -> dict:
    """게시물에 파일 업로드"""
    post = db.get(CommunityPost, post_id)
    if not post or post.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    # Read file content
    file_content = await file.read()
    
    # Upload to S3
    upload_result = await s3_service.upload_file(
        file_content=file_content,
        filename=file.filename or "file",
        file_type=file.content_type or "application/octet-stream",
        folder="community",
    )

    # Save file record to database
    file_record = CommunityPostFile(
        post_id=post_id,
        filename=file.filename or "file",
        file_size=upload_result["file_size"],
        file_type=file.content_type or "application/octet-stream",
        s3_key=upload_result["s3_key"],
        s3_url=upload_result["s3_url"],
        uploaded_by=current_user_id,
    )
    db.add(file_record)
    db.commit()
    db.refresh(file_record)

    return success_response(
        data={
            "id": file_record.id,
            "post_id": file_record.post_id,
            "filename": file_record.filename,
            "file_size": file_record.file_size,
            "file_type": file_record.file_type,
            "s3_url": file_record.s3_url,
            "uploaded_at": file_record.created_at,
        },
    )


@router.get("/{post_id}/files", summary="게시물 첨부 파일 조회", description="게시물의 첨부 파일 목록을 조회합니다.")
async def list_post_files(
    post_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """게시물의 모든 첨부 파일 조회"""
    post = db.get(CommunityPost, post_id)
    if not post or post.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    files = db.query(CommunityPostFile).filter(
        CommunityPostFile.post_id == post_id,
        CommunityPostFile.deleted_at.is_(None),
    ).all()

    return success_response(
        data={
            "files": [
                {
                    "id": f.id,
                    "filename": f.filename,
                    "file_size": f.file_size,
                    "file_type": f.file_type,
                    "s3_url": f.s3_url,
                    "uploaded_at": f.created_at,
                }
                for f in files
            ]
        },
    )


@router.delete("/{post_id}/files/{file_id}", summary="게시물 첨부 파일 삭제", description="게시물의 첨부 파일을 삭제합니다.")
async def delete_post_file(
    post_id: int,
    file_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
    s3_service=Depends(get_s3_service),
) -> dict:
    """게시물 첨부 파일 삭제 (소프트 삭제)"""
    file_record = db.get(CommunityPostFile, file_id)
    if not file_record or file_record.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    # 권한 검증: 업로드한 사람 또는 게시물 작성자만 삭제 가능
    post = db.get(CommunityPost, post_id)
    if file_record.uploaded_by != current_user_id and post.author_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    # S3에서 파일 삭제
    await s3_service.delete_file(file_record.s3_key)

    # DB에서 소프트 삭제
    file_record.deleted_at = func.now()
    db.commit()

    return success_response(data={"deleted": True, "file_id": file_id})
