from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id
from app.models import ChatMessage
from app.models import ChatRoom
from app.models import Project
from app.models import ProjectMember

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
    return success_response(data=[{"id": m.id, "sender_id": m.sender_id, "message": m.message, "created_at": m.created_at} for m in messages])


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

    message = ChatMessage(room_id=room_id, sender_id=current_user_id, message=message_text)
    db.add(message)
    db.commit()
    db.refresh(message)
    return success_response(data={"id": message.id, "room_id": room_id})
