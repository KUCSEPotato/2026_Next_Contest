from fastapi import APIRouter, Body, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.core.realtime import chat_room_channel
from app.core.realtime import realtime_hub
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id
from app.dependencies.auth import get_current_user_id_from_token
from app.models import ChatMessage
from app.models import ChatRoom
from app.models import ChatRoomMember
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


def _ensure_chat_room_member(db: Session, room_id: int, user_id: int) -> None:
    """사용자가 채팅방의 ChatRoomMember인지 확인합니다."""
    member = (
        db.query(ChatRoomMember)
        .filter(
            ChatRoomMember.room_id == room_id,
            ChatRoomMember.user_id == user_id,
        )
        .first()
    )
    if member is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chat room member permission required")


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


@router.post("/projects/{project_id}/rooms", summary="채팅방 생성", description="프로젝트 멤버가 새 채팅방을 생성하고 참여자를 선택합니다.")
async def create_project_chat_room(
    project_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """채팅방 생성 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.
    - body 예시: `{ "name": "backend-discussion", "member_ids": [2, 3, 4] }`

    검증:
    - 프로젝트가 없으면 `404`
    - 프로젝트 멤버가 아니면 `403`
    - member_ids가 없으면 모든 활성 프로젝트 멤버를 참여자로 사용
    - member_ids의 일부가 프로젝트 멤버가 아니면 `400`
    """
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    _ensure_project_member(db, project_id, current_user_id)
    
    # member_ids의 모든 멤버가 프로젝트 멤버인지 검증
    project_member_ids = db.query(ProjectMember.user_id).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.left_at.is_(None),
    ).all()
    project_member_ids = {pm[0] for pm in project_member_ids}

    member_ids = payload.get("member_ids")
    if member_ids is None:
        member_ids = sorted(project_member_ids)
    if not member_ids or not isinstance(member_ids, list):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="member_ids must be a non-empty list")
    
    for member_id in member_ids:
        if member_id not in project_member_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"User {member_id} is not a member of this project")
    
    # 채팅방 생성
    room = ChatRoom(project_id=project_id, name=payload.get("name"), is_active=True)
    db.add(room)
    db.commit()
    db.refresh(room)
    
    # ChatRoomMember 생성
    for member_id in member_ids:
        chat_room_member = ChatRoomMember(room_id=room.id, user_id=member_id)
        db.add(chat_room_member)
    db.commit()
    
    return success_response(data={"id": room.id, "project_id": room.project_id, "name": room.name, "member_ids": member_ids})


@router.get("/rooms/{room_id}/messages", summary="메시지 목록", description="채팅방 멤버가 채팅방 메시지 목록을 조회합니다.")
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
    - 채팅방 멤버가 아니면 `403`
    """
    room = db.get(ChatRoom, room_id)
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    _ensure_chat_room_member(db, room_id, current_user_id)
    messages = db.query(ChatMessage).filter(ChatMessage.room_id == room_id).order_by(ChatMessage.id.asc()).all()
    return success_response(data=[_serialize_chat_message(db, message) for message in messages])


@router.post("/rooms/{room_id}/messages", summary="메시지 전송", description="채팅방 멤버가 채팅 메시지를 전송합니다.")
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
    - 채팅방 멤버가 아니면 `403`
    """
    room = db.get(ChatRoom, room_id)
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    _ensure_chat_room_member(db, room_id, current_user_id)

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

    # ChatRoomMember로 권한 검증
    try:
        _ensure_chat_room_member(db, room_id, current_user_id)
    except HTTPException:
        await websocket.close(code=1008)
        return

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


@router.get("/my/rooms", summary="내 채팅방 목록", description="현재 사용자가 속한 채팅방 목록을 조회합니다.")
async def get_my_chat_rooms(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """내 채팅방 목록 조회 API.

    사용자가 ChatRoomMember로 참여 중인 모든 채팅방을 조회합니다.
    각 채팅방의 최신 메시지 정보를 포함합니다.

    Swagger 테스트 방법:
    - Authorization 헤더에 Bearer access token을 넣습니다.
    
    응답:
    - room_id: 채팅방 ID
    - room_name: 채팅방 이름
    - project_id: 프로젝트 ID
    - project_title: 프로젝트 제목
    - last_message: 마지막 메시지 텍스트
    - last_message_at: 마지막 메시지 시간
    - last_message_sender_nickname: 마지막 메시지 발송자 닉네임
    """
    # 사용자가 ChatRoomMember인 채팅방 찾기
    chat_room_members = (
        db.query(ChatRoomMember)
        .filter(ChatRoomMember.user_id == current_user_id)
        .all()
    )

    room_ids = [crm.room_id for crm in chat_room_members]
    if not room_ids:
        return success_response(data=[])

    # 각 ChatRoom 찾기
    rooms = db.query(ChatRoom).filter(ChatRoom.id.in_(room_ids)).all()

    # 프로젝트 정보 미리 로드
    project_ids = [r.project_id for r in rooms]
    projects = db.query(Project).filter(Project.id.in_(project_ids)).all()
    project_map = {p.id: p for p in projects}

    # 응답 데이터 구성
    response_data = []
    for room in rooms:
        project = project_map.get(room.project_id)
        if not project:
            continue

        # 각 ChatRoom의 최신 메시지 찾기
        latest_message = (
            db.query(ChatMessage)
            .filter(ChatMessage.room_id == room.id)
            .order_by(desc(ChatMessage.created_at))
            .first()
        )

        last_message_sender = None
        if latest_message and latest_message.sender_id:
            last_message_sender = db.get(User, latest_message.sender_id)

        response_data.append(
            {
                "room_id": room.id,
                "room_name": room.name,
                "project_id": room.project_id,
                "project_title": project.title,
                "last_message": latest_message.message if latest_message else None,
                "last_message_at": latest_message.created_at.isoformat() if latest_message else None,
                "last_message_sender_nickname": last_message_sender.nickname if last_message_sender else None,
            }
        )

    return success_response(data=response_data)
