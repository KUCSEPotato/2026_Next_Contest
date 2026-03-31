from fastapi import APIRouter

router = APIRouter()


@router.get("/rooms/{room_id}/messages")
async def list_messages(room_id: int) -> dict:
    return {"message": f"TODO: list messages for room {room_id}"}


@router.post("/rooms/{room_id}/messages")
async def create_message(room_id: int) -> dict:
    return {"message": f"TODO: create message for room {room_id}"}
