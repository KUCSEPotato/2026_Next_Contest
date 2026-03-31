from fastapi import APIRouter

router = APIRouter()


@router.get("")
async def list_notifications() -> dict:
    return {"message": "TODO: list notifications"}


@router.patch("/{notification_id}/read")
async def read_notification(notification_id: int) -> dict:
    return {"message": f"TODO: read notification {notification_id}"}
