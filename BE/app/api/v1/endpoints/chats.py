from fastapi import APIRouter, Body, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.core.realtime import chat_room_channel
from app.core.realtime import realtime_hub
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id
from app.dependencies.auth import get_current_user_id_from_token
from app.models import ChatMessage
from app.models import ChatRoom
from app.models import Project
from app.models import ProjectMember
from app.models import User

router = APIRouter()


def _ensure_project_member(db: Session, project_id: int, user_id: int) -> None:
    member = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
            ProjectMember.left_at.is_(None),
        )
        .first()
    )
    if member is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project member permission required")


def _serialize_chat_message(db: Session, message: ChatMessage) -> dict:
    sender = db.get(User, message.sender_id) if message.sender_id is not None else None
    return {
        "id": message.id,
        "room_id": message.room_id,
        "sender_id": message.sender_id,
        "sender_nickname": sender.nickname if sender else None,
        "sender_avatar_url": sender.avatar_url if sender else None,
        "message": message.message,
        "created_at": message.created_at.isoformat() if message.created_at else None,
    }


def _create_chat_message(db: Session, room_id: int, sender_id: int, message_text: str) -> ChatMessage:
    message = ChatMessage(room_id=room_id, sender_id=sender_id, message=message_text)
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def _serialize_room_summary(db: Session, room: ChatRoom) -> dict:
    project = db.get(Project, room.project_id)
    last_message = (
        db.query(ChatMessage)
        .filter(ChatMessage.room_id == room.id)
        .order_by(ChatMessage.id.desc())
        .first()
    )
    return {
        "room_id": room.id,
        "room_name": room.name,
        "project_id": room.project_id,
        "project_title": project.title if project else None,
        "last_message": last_message.message if last_message else None,
        "last_message_at": last_message.created_at.isoformat() if last_message and last_message.created_at else None,
    }


@router.get("/my/rooms", summary="내 채팅방 목록", description="현재 사용자가 참여 중인 모든 프로젝트의 채팅방을 모아 반환합니다.")
async def list_my_chat_rooms(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """내 채팅방 목록 조회 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.

    응답:
    - 현재 사용자가 ProjectMember로 참여 중인 프로젝트들의 채팅방을 모두 반환합니다.
    - room_id, room_name, project_id, project_title, last_message, last_message_at 포함
    """
    member_project_ids = (
        db.query(ProjectMember.project_id)
        .filter(ProjectMember.user_id == current_user_id, ProjectMember.left_at.is_(None))
        .distinct()
        .all()
    )
    project_ids = [project_id for (project_id,) in member_project_ids]
    if not project_ids:
        return success_response(data=[])

    rooms = (
        db.query(ChatRoom)
        .filter(ChatRoom.project_id.in_(project_ids))
        .order_by(ChatRoom.id.asc())
        .all()
    )
    return success_response(data=[_serialize_room_summary(db, room) for room in rooms])


@router.get("/projects/{project_id}/rooms", summary="채팅방 목록", description="프로젝트 멤버가 프로젝트 채팅방 목록을 조회합니다.")
async def list_project_chat_rooms(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """채팅방 목록 조회 API.

    Swagger 테스트 방법:
    - Authorization 헤더에 Bearer access token을 넣습니다.
    - 프로젝트 멤버가 아니면 403을 반환합니다.
    """
    if db.get(Project, project_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    _ensure_project_member(db, project_id, current_user_id)
    rooms = db.query(ChatRoom).filter(ChatRoom.project_id == project_id).order_by(ChatRoom.id.asc()).all()
    return success_response(
        data=[{"id": room.id, "name": room.name, "is_active": room.is_active} for room in rooms]
    )


@router.post("/projects/{project_id}/rooms", summary="채팅방 생성", description="프로젝트 멤버가 새 채팅방을 생성합니다.")
async def create_project_chat_room(
    project_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """채팅방 생성 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.
    - body 예시: `{ "name": "backend-discussion" }`

    검증:
    - 프로젝트가 없으면 `404`
    - 프로젝트 멤버가 아니면 `403`
    """
    if db.get(Project, project_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    _ensure_project_member(db, project_id, current_user_id)
    room = ChatRoom(project_id=project_id, name=payload.get("name"), is_active=True)
    db.add(room)
    db.commit()
    db.refresh(room)
    return success_response(data={"id": room.id, "project_id": room.project_id, "name": room.name})


@router.get("/rooms/{room_id}/messages", summary="메시지 목록", description="프로젝트 멤버가 채팅방 메시지 목록을 조회합니다.")
async def list_messages(
    room_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """메시지 목록 조회 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.
    - path의 `room_id`를 전달합니다.

    검증:
    - 방이 없으면 `404`
    - 프로젝트 멤버가 아니면 `403`
    """
    room = db.get(ChatRoom, room_id)
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    _ensure_project_member(db, room.project_id, current_user_id)
    messages = db.query(ChatMessage).filter(ChatMessage.room_id == room_id).order_by(ChatMessage.id.asc()).all()
    return success_response(data=[_serialize_chat_message(db, message) for message in messages])


@router.post("/rooms/{room_id}/messages", summary="메시지 전송", description="프로젝트 멤버가 채팅 메시지를 전송합니다.")
async def create_message(
    room_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """메시지 전송 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.
    - body 예시: `{ "message": "안녕하세요" }`

    검증:
    - message 누락 시 `400`
    - 방이 없으면 `404`
    - 프로젝트 멤버가 아니면 `403`
    """
    room = db.get(ChatRoom, room_id)
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    _ensure_project_member(db, room.project_id, current_user_id)

    message_text = payload.get("message")
    if not message_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="message is required")

    message = _create_chat_message(db, room_id, current_user_id, message_text)
    await realtime_hub.broadcast_json(
        chat_room_channel(room_id),
        {
            "type": "chat.message.created",
            "data": _serialize_chat_message(db, message),
        },
    )
    return success_response(data={"id": message.id, "room_id": room_id})


@router.websocket("/projects/{project_id}/rooms/{room_id}/ws")
async def chat_room_websocket(
    websocket: WebSocket,
    project_id: int,
    room_id: int,
    db: Session = Depends(get_db),
) -> None:
    token = websocket.query_params.get("token") or websocket.query_params.get("access_token")
    if not token:
        await websocket.close(code=1008)
        return

    try:
        current_user_id = get_current_user_id_from_token(token)
    except HTTPException:
        await websocket.close(code=1008)
        return

    project = db.get(Project, project_id)
    room = db.get(ChatRoom, room_id)
    if project is None or room is None or room.project_id != project_id:
        await websocket.close(code=1008)
        return

    _ensure_project_member(db, project_id, current_user_id)

    channel = chat_room_channel(room_id)
    await realtime_hub.connect(channel, websocket)
    try:
        history = db.query(ChatMessage).filter(ChatMessage.room_id == room_id).order_by(ChatMessage.id.asc()).all()
        await websocket.send_json({"type": "chat.history", "data": [_serialize_chat_message(db, message) for message in history]})

        while True:
            payload = await websocket.receive_json()
            event_type = payload.get("type", "chat.message.create")

            if event_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if event_type != "chat.message.create":
                await websocket.send_json({"type": "error", "detail": "Unsupported event type"})
                continue

            message_text = payload.get("message")
            if not message_text:
                await websocket.send_json({"type": "error", "detail": "message is required"})
                continue

            message = _create_chat_message(db, room_id, current_user_id, message_text)
            await realtime_hub.broadcast_json(
                channel,
                {
                    "type": "chat.message.created",
                    "data": _serialize_chat_message(db, message),
                },
            )
    except WebSocketDisconnect:
        pass
    finally:
        realtime_hub.disconnect(channel, websocket)
