"""Community Forum Request/Response Schemas"""

from datetime import datetime
from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════
# ━━ Community Post Schemas
# ═══════════════════════════════════════════════════════════════

class PostCreateRequest(BaseModel):
    """Create a new community post"""
    title: str = Field(..., min_length=1, max_length=300)
    content: str = Field(..., min_length=1)
    category: str = Field(default="general", pattern="^(general|question|idea|showcase|event|announcement)$")


class PostUpdateRequest(BaseModel):
    """Update a community post"""
    title: str | None = Field(None, min_length=1, max_length=300)
    content: str | None = Field(None, min_length=1)
    category: str | None = Field(None, pattern="^(general|question|idea|showcase|event|announcement)$")


class PostResponse(BaseModel):
    """Community post response"""
    id: int
    author_id: int
    title: str
    content: str
    category: str
    is_pinned: bool
    view_count: int
    created_at: datetime
    updated_at: datetime


class PostDetailResponse(PostResponse):
    """Detailed post response with author info and stats"""
    author: dict  # {id, nickname, avatar_url}
    comment_count: int
    reaction_stats: dict  # {like: 5, interested: 3, helpful: 2, curious: 1}
    user_reaction: str | None  # 현재 사용자의 반응


# ═══════════════════════════════════════════════════════════════
# ━━ Community Comment Schemas
# ═══════════════════════════════════════════════════════════════

class CommentCreateRequest(BaseModel):
    """Create a new comment on a post"""
    content: str = Field(..., min_length=1)
    parent_comment_id: int | None = None


class CommentUpdateRequest(BaseModel):
    """Update a comment"""
    content: str = Field(..., min_length=1)


class CommentResponse(BaseModel):
    """Comment response"""
    id: int
    post_id: int
    author_id: int
    content: str
    parent_comment_id: int | None
    created_at: datetime
    updated_at: datetime


class CommentDetailResponse(CommentResponse):
    """Detailed comment response with author info and stats"""
    author: dict  # {id, nickname, avatar_url}
    reaction_stats: dict  # {like, interested, helpful, curious counts}
    user_reaction: str | None
    reply_count: int


# ═══════════════════════════════════════════════════════════════
# ━━ Reaction Schemas
# ═══════════════════════════════════════════════════════════════

class ReactionRequest(BaseModel):
    """Add or remove a reaction"""
    reaction_type: str = Field(..., pattern="^(like|interested|helpful|curious)$")


class ReactionStatsResponse(BaseModel):
    """Reaction statistics for a post or comment"""
    like: int
    interested: int
    helpful: int
    curious: int
    user_reaction: str | None  # Current user's reaction or null


# ═══════════════════════════════════════════════════════════════
# ━━ List Response Schemas
# ═══════════════════════════════════════════════════════════════

class PostListResponse(BaseModel):
    """List of posts with pagination"""
    posts: list[PostDetailResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class CommentListResponse(BaseModel):
    """List of comments for a post"""
    comments: list[CommentDetailResponse]
    total: int
