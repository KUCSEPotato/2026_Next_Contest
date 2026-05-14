from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id
from app.models import Notification

router = APIRouter()


def _notification_data(value) -> dict:
    return value if isinstance(value, dict) else {}


@router.get("", summary="알림 목록", description="현재 사용자의 알림 목록을 최신순으로 조회합니다.")
async def list_notifications(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """알림 목록 조회 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.

    응답:
    - 최신순으로 정렬된 알림 목록을 반환합니다.
    """
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user_id)
        .order_by(Notification.id.desc())
        .all()
    )
    data = []
    for notification in notifications:
        notification_data = _notification_data(notification.data)
        data.append(
            {
                "id": notification.id,
                "type": notification.type,
                "title": notification.title,
                "body": notification.body,
                "data": notification_data,
                "project_id": notification_data.get("project_id"),
                "url": notification_data.get("url"),
                "is_read": notification.is_read,
                "created_at": notification.created_at,
            }
        )
    return success_response(data=data)


@router.patch("/read-all", summary="알림 모두 읽음 처리", description="현재 사용자의 읽지 않은 알림을 모두 읽음 처리합니다.")
async def read_all_notifications(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    now = datetime.now(timezone.utc)
    updated_count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user_id, Notification.is_read.is_(False))
        .update(
            {Notification.is_read: True, Notification.read_at: now},
            synchronize_session=False,
        )
    )
    db.commit()
    return success_response(data={"updated_count": updated_count})


@router.patch("/{notification_id}/read", summary="알림 읽음 처리", description="지정한 알림을 읽음 상태로 변경합니다.")
async def read_notification(
    notification_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """알림 읽음 처리 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.
    - path의 `notification_id`를 전달합니다.

    검증:
    - 본인 알림이 아니거나 존재하지 않으면 `404`
    """
    notification = db.get(Notification, notification_id)
    if notification is None or notification.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    notification.is_read = True
    notification.read_at = datetime.now(timezone.utc)
    db.commit()
    return success_response(data={"id": notification.id, "is_read": True})
