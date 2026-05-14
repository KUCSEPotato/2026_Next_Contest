from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id
from app.models import ChatRoom
from app.models import ChatRoomMember
from app.models import CommunityPost
from app.models import CommunityPostComment
from app.models import Project
from app.models import Report
from app.models import AdoptionRequest
from app.models import Review
from app.models import User

router = APIRouter()


class ReportCreateRequest(BaseModel):
    target_type: Literal["user", "project", "post", "comment", "chat", "review", "adoption_request"]
    target_id: int = Field(gt=0)
    reason: str = Field(min_length=1, max_length=1000)


def _clean_reason(reason: str) -> str:
    cleaned = reason.strip()
    if not cleaned:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Report reason is required")
    return cleaned


def _ensure_not_admin_content(db: Session, author_id: int) -> None:
    author = db.get(User, author_id)
    if author is not None and author.role == "admin":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin-authored content cannot be reported")


@router.post("", summary="신고 접수", description="사용자가 사용자/프로젝트/게시글/댓글/채팅방/평가/팀장 넘겨주기 요청을 신고합니다.")
async def create_report(
    payload: ReportCreateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    reason = _clean_reason(payload.reason)
    report_data: dict[str, int | str] = {
        "reporter_id": current_user_id,
        "reason": reason,
        "status": "open",
    }

    if payload.target_type == "user":
        target_user = db.get(User, payload.target_id)
        if target_user is None or target_user.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        if target_user.id == current_user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot report yourself")
        report_data["target_user_id"] = target_user.id

    elif payload.target_type == "project":
        project = db.get(Project, payload.target_id)
        if project is None or project.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        report_data["target_project_id"] = project.id

    elif payload.target_type == "post":
        post = db.get(CommunityPost, payload.target_id)
        if post is None or post.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
        _ensure_not_admin_content(db, post.author_id)
        report_data["target_post_id"] = post.id

    elif payload.target_type == "comment":
        comment = db.get(CommunityPostComment, payload.target_id)
        if comment is None or comment.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        _ensure_not_admin_content(db, comment.author_id)
        report_data["target_comment_id"] = comment.id

    elif payload.target_type == "chat":
        chat_room = db.get(ChatRoom, payload.target_id)
        if chat_room is None or not chat_room.is_active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat room not found")
        member = (
            db.query(ChatRoomMember)
            .filter(ChatRoomMember.room_id == chat_room.id, ChatRoomMember.user_id == current_user_id)
            .first()
        )
        if member is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chat room access required")
        report_data["target_chat_room_id"] = chat_room.id

    elif payload.target_type == "review":
        review = db.get(Review, payload.target_id)
        if review is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
        _ensure_not_admin_content(db, review.reviewer_id)
        report_data["target_review_id"] = review.id

    elif payload.target_type == "adoption_request":
        adoption_request = db.get(AdoptionRequest, payload.target_id)
        if adoption_request is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Adoption request not found")
        _ensure_not_admin_content(db, adoption_request.requester_id)
        report_data["target_adoption_request_id"] = adoption_request.id

    report = Report(**report_data)
    db.add(report)
    db.commit()
    db.refresh(report)

    return success_response(
        data={
            "id": report.id,
            "target_type": payload.target_type,
            "target_id": payload.target_id,
            "status": report.status,
        }
    )
