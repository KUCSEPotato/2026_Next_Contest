import asyncio
import re
from datetime import datetime, timezone, date
from collections import defaultdict
from math import ceil

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi import WebSocket, WebSocketDisconnect
from google import genai
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.api.v1.endpoints.llm import _call_gemini_for_todo_list
from app.api.v1.endpoints.llm import _parse_gemini_response
from app.core.config import settings
from app.core.realtime import project_todo_channel
from app.core.realtime import realtime_hub
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id
from app.dependencies.auth import get_current_user_id_from_token
from app.models import Application
from app.models import ChatMessage
from app.models import ChatRoom
from app.models import ChatRoomMember
from app.models import FailureStory
from app.models import Idea
from app.models import Invitation
from app.models import Notification
from app.models import Project
from app.models import ProjectMember
from app.models import ProjectMilestone
from app.models import ProjectRecruitment
from app.models import TodoAssignment
from app.models import ProjectSkill
from app.models import Skill
from app.models import Retrospective
from app.models import Review
from app.models import Todo
from app.models import User
from app.models import UserRatingAggregate
from app.schemas import ApplicationCreateRequest
from app.schemas import ApplicationDecisionRequest
from app.schemas import MilestoneCreateRequest
from app.schemas import MilestoneUpdateRequest
from app.schemas import ProjectCreateRequest
from app.schemas import ProjectStatusUpdateRequest
from app.schemas import ProjectUpdateRequest
from app.schemas import RecruitmentCreateRequest
from app.schemas import RecruitmentUpdateRequest
from app.schemas import TodoCreateRequest
from app.schemas import TodoUpdateRequest
from app.schemas import MemoirCreateRequest
from app.schemas import MemoirRefineRequest
from app.services.economy import reward_project_completed
from app.services.economy import reward_project_registration
from app.services.economy import reward_project_recycled
from app.services.economy import reward_project_started
from app.core.realtime import project_todo_channel
from app.core.realtime import chat_room_channel
from app.core.realtime import realtime_hub

router = APIRouter()

TODO_FINALIZED_MARKER_TITLE = "__team_todo_finalized__"


IDEA_DESCRIPTION_SECTION_LABELS = (
    "예상 진행 기간",
    "이런 분과 함께하고 싶어요",
)


def _normalize_skill_name(skill_name: str) -> str:
    return re.sub(r"\s+", " ", skill_name.strip()).lower()


def _extract_idea_description_parts(description: str | None) -> dict[str, str]:
    text = description or ""
    labels = "|".join(re.escape(label) for label in IDEA_DESCRIPTION_SECTION_LABELS)
    pattern = re.compile(
        rf"<b>\[\s*(?P<label>{labels})\s*\]</b>\s*(?P<value>.*?)(?=\n\s*<b>\[|$)",
        re.DOTALL,
    )
    sections = {match.group("label"): match.group("value").strip() for match in pattern.finditer(text)}
    clean_description = pattern.sub("", text).strip()

    return {
        "description": clean_description,
        "expected_period": sections.get("예상 진행 기간", ""),
        "preferred_members": sections.get("이런 분과 함께하고 싶어요", ""),
    }


def _compose_idea_description(
    description: str,
    expected_period: str | None = None,
    preferred_members: str | None = None,
) -> str:
    parts = [description.strip()]
    if expected_period and expected_period.strip():
        parts.append(f"<b>[ 예상 진행 기간 ]</b>\n{expected_period.strip()}")
    if preferred_members and preferred_members.strip():
        parts.append(f"<b>[ 이런 분과 함께하고 싶어요 ]</b>\n{preferred_members.strip()}")
    return "\n\n".join(part for part in parts if part)


def _sync_project_skills(db: Session, project_id: int, tech_stack: list[str]) -> None:
    db.query(ProjectSkill).filter(ProjectSkill.project_id == project_id).delete()
    seen_skill_ids: set[int] = set()

    for skill_name in tech_stack:
        skill_name = skill_name.strip()
        if not skill_name:
            continue

        normalized_name = _normalize_skill_name(skill_name)
        skill = db.query(Skill).filter(Skill.normalized_name == normalized_name).first()
        if skill is None:
            skill = Skill(name=skill_name, normalized_name=normalized_name)
            db.add(skill)
            db.flush()

        if skill.id in seen_skill_ids:
            continue

        db.add(ProjectSkill(project_id=project_id, skill_id=skill.id))
        seen_skill_ids.add(skill.id)


def _calculate_days_left(deadline: date | None) -> int | None:
    """마감일까지 남은 일수를 계산합니다. deadline이 None이면 None 반환."""
    if deadline is None:
        return None
    days = (deadline - date.today()).days
    return max(0, days)


def _is_urgent(deadline: date | None) -> bool:
    """마감일이 7일 이내면 긴급 표시. deadline이 None이면 False."""
    if deadline is None:
        return False
    days_left = _calculate_days_left(deadline)
    return 0 <= days_left <= 7


def _build_recruitment_response(recruitment: ProjectRecruitment) -> dict:
    """recruitment 응답을 빌드합니다."""
    days_left = _calculate_days_left(recruitment.deadline)
    return {
        "id": recruitment.id,
        "position_name": recruitment.position_name,
        "required_count": recruitment.required_count,
        "difficulty": recruitment.difficulty,
        "category": recruitment.category,
        "summary": recruitment.summary,
        "status": recruitment.status,
        "deadline": recruitment.deadline.isoformat() if recruitment.deadline else None,
        "daysLeft": days_left,
        "isUrgent": _is_urgent(recruitment.deadline),
        "description": recruitment.description,
    }


def _project_notification_data(project_id: int) -> dict:
    return {
        "project_id": project_id,
        "url": f"/projects/{project_id}",
    }


def _build_recruitment_response_with_competition(db: Session, recruitment: ProjectRecruitment) -> dict:
    """경쟁률을 포함한 recruitment 응답을 빌드합니다."""
    # 지원자 수 계산 (pending 상태만)
    applicant_count = (
        db.query(func.count(Application.id))
        .filter(
            Application.project_id == recruitment.project_id,
            Application.status == "pending",
        )
        .scalar() or 0
    )
    
    # 경쟁률 계산 (모집 인원 0이면 0.0)
    competition_ratio = (
        round(applicant_count / recruitment.required_count, 2)
        if recruitment.required_count > 0
        else 0.0
    )
    
    days_left = _calculate_days_left(recruitment.deadline)
    return {
        "id": recruitment.id,
        "position_name": recruitment.position_name,
        "required_count": recruitment.required_count,
        "applicant_count": applicant_count,
        "competition_ratio": competition_ratio,
        "competition_ratio_percent": f"{competition_ratio * 100:.1f}%",
        "difficulty": recruitment.difficulty,
        "category": recruitment.category,
        "summary": recruitment.summary,
        "status": recruitment.status,
        "deadline": recruitment.deadline.isoformat() if recruitment.deadline else None,
        "daysLeft": days_left,
        "isUrgent": _is_urgent(recruitment.deadline),
        "description": recruitment.description,
    }


def _get_project_or_404(db: Session, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _ensure_project_leader(project: Project, user_id: int) -> None:
    if project.leader_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Leader permission required")


def _ensure_project_member(db: Session, project_id: int, user_id: int) -> None:
    exists = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
            ProjectMember.left_at.is_(None),
        )
        .first()
    )
    if exists is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project member permission required")


def _get_active_project_member_ids(db: Session, project_id: int) -> set[int]:
    rows = (
        db.query(ProjectMember.user_id)
        .filter(ProjectMember.project_id == project_id, ProjectMember.left_at.is_(None))
        .all()
    )
    return {user_id for (user_id,) in rows}


def _normalize_assignee_ids(payload: TodoCreateRequest | TodoUpdateRequest) -> list[int]:
    if payload.assignee_ids:
        return list(dict.fromkeys(payload.assignee_ids))
    if payload.assignee_id is not None:
        return [payload.assignee_id]
    return []


def _validate_todo_assignees(db: Session, project_id: int, assignee_ids: list[int]) -> None:
    if not assignee_ids:
        return
    member_ids = _get_active_project_member_ids(db, project_id)
    invalid_ids = [user_id for user_id in assignee_ids if user_id not in member_ids]
    if invalid_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Todo assignees must be project members")


def _sync_todo_assignments(db: Session, todo: Todo, assignee_ids: list[int]) -> None:
    existing_assignments = db.query(TodoAssignment).filter(TodoAssignment.todo_id == todo.id).all()
    for assignment in existing_assignments:
        db.delete(assignment)

    if not assignee_ids:
        todo.assignee_id = None
        return

    todo.assignee_id = assignee_ids[0]
    for user_id in assignee_ids:
        db.add(TodoAssignment(todo_id=todo.id, user_id=user_id, is_done=False))


def _serialize_todo_assignments(db: Session, todo_ids: list[int]) -> dict[int, list[dict]]:
    if not todo_ids:
        return {}

    assignments = db.query(TodoAssignment).filter(TodoAssignment.todo_id.in_(todo_ids)).all()
    user_ids = {assignment.user_id for assignment in assignments}
    users = {user.id: user for user in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}

    grouped: dict[int, list[dict]] = defaultdict(list)
    for assignment in assignments:
        user = users.get(assignment.user_id)
        grouped[assignment.todo_id].append(
            {
                "id": assignment.id,
                "user_id": assignment.user_id,
                "nickname": user.nickname if user else None,
                "avatar_url": user.avatar_url if user else None,
                "is_done": assignment.is_done,
                "done_at": assignment.done_at.isoformat() if assignment.done_at else None,
            }
        )
    return grouped


def _build_todo_response(todo: Todo, assignments: list[dict] | None = None) -> dict:
    return {
        "id": todo.id,
        "title": todo.title,
        "description": todo.description,
        "stage": todo.stage,
        "status": todo.status,
        "priority": todo.priority,
        "due_date": todo.due_date.isoformat() if todo.due_date else None,
        "completed_at": todo.completed_at.isoformat() if todo.completed_at else None,
        "assignee_id": todo.assignee_id,
        "assignments": assignments or [],
    }


def _build_memoir_response(memoir: Retrospective) -> dict:
    return {
        "id": memoir.id,
        "project_id": memoir.project_id,
        "author_id": memoir.author_id,
        "title": memoir.title,
        "tech_stack": memoir.tech_stack,
        "domain": memoir.domain,
        "felt_point": memoir.felt_point,
        "lacked_point": memoir.lacked_point,
        "ai_refined_felt": memoir.ai_refined_felt,
        "ai_refined_lacked": memoir.ai_refined_lacked,
        "created_at": memoir.created_at.isoformat() if memoir.created_at else None,
        "updated_at": memoir.updated_at.isoformat() if memoir.updated_at else None,
    }


def _fallback_ai_todo_titles(project: Project) -> list[str]:
    return [
        f"기획 단계 - {project.title} 핵심 사용자 흐름 확정하기 :: 프로젝트를 처음 사용하는 사용자가 어떤 순서로 기능을 이용하고, 어떤 상태가 완료 기준인지 문서로 정리한다.",
        "기획 단계 - 프로젝트 세부 계획과 MVP 범위 결정하기 :: 반드시 구현할 기능, 시간이 남으면 구현할 기능, 제외할 기능을 나누어 팀이 같은 기준으로 개발하도록 한다.",
        "기획 단계 - 팀원별 역할과 담당 영역 기록하기 :: 프론트엔드, 백엔드, 디자인, 검증 등 담당자를 정하고 각자가 맡을 산출물을 Todo 상세에 남긴다.",
        "설계 단계 - 화면 단위 기능 목록과 이동 흐름 만들기 :: 주요 페이지별 입력값, 버튼, 빈 상태, 오류 상태를 정리해 구현 순서를 잡는다.",
        "설계 단계 - API와 데이터 모델 목록 작성하기 :: 필요한 엔드포인트, 요청/응답 필드, 저장해야 할 테이블 또는 컬럼을 기능별로 정리한다.",
        "개발 단계 - 백엔드 핵심 API 구현하기 :: 프로젝트 생성, 조회, 수정처럼 MVP에 필요한 API를 우선 구현하고 응답 형식을 프론트와 맞춘다.",
        "개발 단계 - 프론트엔드 주요 화면 구현하기 :: 사용자가 가장 먼저 접하는 목록, 상세, 작성 화면을 연결하고 실제 API 데이터로 렌더링한다.",
        "검증 단계 - 핵심 플로우 테스트와 수정 사항 기록하기 :: 실제 계정으로 생성부터 완료까지 진행해보고 실패한 케이스와 수정 담당자를 남긴다.",
    ]


def _build_ai_todo_context(
    project: Project,
    members: list[ProjectMember],
    member_users: dict[int, User],
    messages: list[ChatMessage],
) -> str:
    member_lines = [
        f"- {member_users[member.user_id].nickname if member.user_id in member_users else f'User #{member.user_id}'}: {member.role_in_project}"
        for member in members
    ]
    message_lines = []
    for message in messages:
        sender = member_users.get(message.sender_id) if message.sender_id is not None else None
        sender_name = sender.nickname if sender else "시스템"
        message_lines.append(f"{sender_name}: {message.message}")

    return "\n".join(
        [
            "[프로젝트 정보]",
            f"제목: {project.title}",
            f"한줄소개: {project.summary or ''}",
            f"상세내용: {project.description or ''}",
            "",
            "[팀원]",
            "\n".join(member_lines) or "팀원 정보 없음",
            "",
            "[최근 채팅]",
            "\n".join(message_lines) or "최근 채팅 없음",
        ]
    )


async def _generate_ai_todo_titles(context_text: str, project: Project) -> list[str]:
    if not settings.gemini_api_key:
        return _fallback_ai_todo_titles(project)

    try:
        response_text = await _call_gemini_for_todo_list(context_text)
        todos_by_user = _parse_gemini_response(response_text)
    except HTTPException:
        return _fallback_ai_todo_titles(project)

    titles: list[str] = []
    for todos in todos_by_user.values():
        if not isinstance(todos, list):
            continue
        for todo in todos:
            if isinstance(todo, str) and todo.strip():
                titles.append(todo.strip())

    deduped_titles = list(dict.fromkeys(titles))
    return deduped_titles[:18] or _fallback_ai_todo_titles(project)


def _fallback_memoir_refine(feelings: str, shortcomings: str) -> str:
    feeling_text = feelings.strip()
    shortcoming_text = shortcomings.strip()
    parts: list[str] = []

    if feeling_text:
        parts.append(
            "이번 회고에서 가장 먼저 보이는 것은, 단순히 결과를 남겼다는 사실보다 "
            "새로운 역할과 상황 안으로 직접 들어가 보았다는 점입니다. "
            f"당신이 적어둔 '{feeling_text}'라는 기록에는 낯선 일을 시작하며 얻은 감각과, "
            "그 경험을 다음 성장의 재료로 삼으려는 마음이 함께 담겨 있습니다."
        )
    if shortcoming_text:
        parts.append(
            f"아쉬움으로 남긴 '{shortcoming_text}' 역시 실패의 표시라기보다 다음번에 더 선명하게 준비할 수 있는 단서에 가깝습니다. "
            "무엇이 막혔는지 알아차렸다는 것은 이미 개선의 출발선을 잡았다는 뜻이니까요."
        )
    parts.append(
        "다음 프로젝트에서는 이번에 발견한 감각을 조금 더 구체적인 행동으로 옮겨보면 좋겠습니다. "
        "작게 계획하고, 자주 확인하고, 팀원들과 더 이른 시점에 공유한다면 이번 경험은 훨씬 단단한 자신감으로 이어질 수 있습니다."
    )
    return "\n\n".join(parts)


async def _call_gemini_for_memoir_refine(feelings: str, shortcomings: str) -> str:
    if not settings.gemini_api_key:
        return _fallback_memoir_refine(feelings, shortcomings)
    return await asyncio.to_thread(_sync_call_gemini_for_memoir_refine, feelings, shortcomings)


def _sync_call_gemini_for_memoir_refine(feelings: str, shortcomings: str) -> str:
    prompt = (
        "당신은 사용자의 프로젝트 회고를 함께 읽고 대화하듯 정리해주는 성장 코치입니다.\n"
        "목표는 원문을 예쁘게 끼워 넣는 것이 아니라, 사용자가 적은 경험의 의미를 이해하고 "
        "그 안의 감정, 배움, 아쉬움, 다음 성장 방향을 선명하게 정리해주는 것입니다.\n\n"

        "응답 방식:\n"
        "1. 사용자가 쓴 표현을 그대로 반복하거나 템플릿 문장에 끼워 넣지 마세요.\n"
        "2. 입력에 담긴 맥락을 해석해 '왜 이 경험이 의미 있었는지'를 짚어주세요.\n"
        "3. 아쉬운 점은 비난하지 말고, 다음에 시도할 수 있는 구체적인 개선 방향으로 바꿔주세요.\n"
        "4. 근거 없는 성과나 사용자가 말하지 않은 사실을 지어내지 마세요.\n"
        "5. 너무 감상적이거나 과장된 문체는 피하고, 따뜻하지만 담백한 말투로 작성하세요.\n"
        "6. 3~5개의 짧은 문단으로 작성하세요. 각 문단은 2~4문장 정도가 좋습니다.\n"
        "7. 마지막 문단에는 다음 프로젝트에서 시도해볼 만한 구체적인 행동을 1~2개 자연스럽게 제안하세요.\n"
        "8. 제목, JSON, 마크다운, 따옴표, 불릿 목록은 쓰지 마세요.\n\n"

        "사용자가 남긴 회고 자료:\n"
        f"{feelings}\n\n"
        "사용자가 아쉬움으로 남긴 내용:\n"
        f"{shortcomings}\n"
    )

    client = genai.Client(api_key=settings.gemini_api_key)
    try:
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=prompt,
            config={
                    "temperature": 0.85,
                    "max_output_tokens": 900,
                },
        )
    except Exception:
        return _fallback_memoir_refine(feelings, shortcomings)

    text = getattr(response, "text", None) or getattr(response, "content", None)
    if not text:
        candidates = getattr(response, "candidates", None)
        if isinstance(candidates, list) and len(candidates) > 0:
            candidate = candidates[0]
            text = getattr(candidate, "content", None) or getattr(candidate, "output", None) or ""

    return (text or "").strip()


def _split_ai_todo_item(raw_title: str) -> tuple[str, str, str | None]:
    normalized = raw_title.strip().strip("-• ")
    detail = None
    for separator in (" :: ", " - 상세: ", " 상세: "):
        if separator in normalized:
            normalized, detail = normalized.split(separator, 1)
            detail = detail.strip()[:500] or None
            break

    if " - " in normalized:
        stage, title = normalized.split(" - ", 1)
        return stage.strip()[:30] or "planning", title.strip()[:200], detail
    if ":" in normalized:
        stage, title = normalized.split(":", 1)
        return stage.strip()[:30] or "planning", title.strip()[:200], detail
    return "AI 추천", normalized[:200], detail


async def _broadcast_todo_snapshot(db: Session, project_id: int, todo: Todo, event_type: str) -> None:
    assignments = _serialize_todo_assignments(db, [todo.id]).get(todo.id, [])
    await realtime_hub.broadcast_json(
        project_todo_channel(project_id),
        {
            "type": event_type,
            "data": _build_todo_response(todo, assignments),
        },
    )


def _get_todo_finalized_marker(db: Session, project_id: int) -> ProjectMilestone | None:
    return (
        db.query(ProjectMilestone)
        .filter(
            ProjectMilestone.project_id == project_id,
            ProjectMilestone.title == TODO_FINALIZED_MARKER_TITLE,
        )
        .first()
    )


def _build_todo_state_response(db: Session, project_id: int) -> dict:
    marker = _get_todo_finalized_marker(db, project_id)
    return {
        "project_id": project_id,
        "is_finalized": marker is not None,
    }


async def _broadcast_todo_state(db: Session, project_id: int) -> None:
    await realtime_hub.broadcast_json(
        project_todo_channel(project_id),
        {
            "type": "todo.state.updated",
            "data": _build_todo_state_response(db, project_id),
        },
    )


@router.post("", summary="프로젝트 생성", description="새 프로젝트를 생성하고 생성자를 리더 멤버로 등록합니다.")
async def create_project(
    payload: ProjectCreateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 생성 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정하고 ProjectCreateRequest body를 전달합니다.
    - 생성 성공 시 프로젝트와 리더 멤버 매핑이 함께 생성됩니다.
    """
    project = Project(
        idea_id=payload.idea_id,
        leader_id=current_user_id,
        title=payload.title,
        summary=payload.summary,
        description=payload.description,
        category=payload.category,
        difficulty=payload.difficulty,
        status=payload.status,
        progress_percent=payload.progress_percent,
        max_members=payload.max_members,
        min_members=payload.min_members,
        is_public=payload.is_public,
    )
    db.add(project)
    db.flush()

    db.add(ProjectMember(project_id=project.id, user_id=current_user_id, role_in_project="leader"))
    reward_project_registration(db, project)
    db.add(
        Notification(
            user_id=current_user_id,
            type="project_update",
            title="프로젝트가 등록되었습니다",
            body=f"'{project.title}' 프로젝트가 생성되었습니다.",
            data=_project_notification_data(project.id),
        )
    )
    db.commit()
    db.refresh(project)
    return success_response(data={"id": project.id, "title": project.title, "max_members": project.max_members})


@router.get("", summary="프로젝트 목록", description="프로젝트 목록을 페이지네이션과 상태 필터로 조회합니다.")
async def list_projects(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 목록 조회 API.

    Swagger 테스트 방법:
    - query `page`, `size`, `status`로 필터/페이지네이션을 적용합니다.
    - meta에 전체 건수(total)를 함께 반환합니다.
    """
    query = db.query(Project)
    query = query.filter(Project.deleted_at.is_(None))
    if status_filter:
        query = query.filter(Project.status == status_filter)

    total = query.count()
    projects = query.order_by(Project.created_at.desc()).offset((page - 1) * size).limit(size).all()
    
    data = []
    for p in projects:
        current_members = db.query(func.count(ProjectMember.id)).filter(
            ProjectMember.project_id == p.id,
            ProjectMember.left_at.is_(None)
        ).scalar() or 0

        tech_stack = db.query(Skill.name).join(
            ProjectSkill, ProjectSkill.skill_id == Skill.id
        ).filter(ProjectSkill.project_id == p.id).all()
        tech_stack_list = [s[0] for s in tech_stack]

        applicant_count = db.query(func.count(Application.id)).filter(
            Application.project_id == p.id,
            Application.status == "pending",
        ).scalar() or 0

        open_recruitment = (
            db.query(ProjectRecruitment)
            .filter(
                ProjectRecruitment.project_id == p.id,
                ProjectRecruitment.status == "open",
            )
            .order_by(ProjectRecruitment.created_at.desc())
            .first()
        )

        total_members = p.max_members or 0
        remaining_seats = max(total_members - current_members, 0)

        competition_ratio = (
            round(applicant_count / remaining_seats, 1)
            if remaining_seats > 0
            else 0
        )

        data.append({
            "id": p.id,
            "title": p.title,
            "summary": p.summary,
            "description": p.description,
            "category": p.category,
            "status": p.status,
            "difficulty": p.difficulty,
            "progress_percent": float(p.progress_percent),
            "leader_id": p.leader_id,
            "currentMembers": current_members,
            "maxMembers": p.max_members,
            "techStack": tech_stack_list,
            "applicantCount": applicant_count,
            "remainingSeats": remaining_seats,
            "competitionRatio": competition_ratio,
            "openRecruitmentCount": 1 if open_recruitment else 0,
            "openRecruitmentRequiredCount": open_recruitment.required_count if open_recruitment else 0,
            "openRecruitmentPosition": open_recruitment.position_name if open_recruitment else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    
    return success_response(
        data=data,
        meta={"page": page, "size": size, "total": total},
    )


def _serialize_project_member(member: ProjectMember, user: User | None) -> dict:
    return {
        "user_id": member.user_id,
        "role_in_project": member.role_in_project,
        "nickname": user.nickname if user else None,
        "name": user.name if user else None,
        "avatar_url": user.avatar_url if user else None,
        "user": {
            "id": user.id,
            "nickname": user.nickname,
            "name": user.name,
            "avatar_url": user.avatar_url,
        }
        if user
        else None,
    }


@router.get("/{project_id}", summary="프로젝트 상세", description="프로젝트 상세와 활성 멤버 목록을 조회합니다.")
async def get_project(project_id: int, db: Session = Depends(get_db)) -> dict:
    """프로젝트 상세 조회 API.

    Swagger 테스트 방법:
    - path의 `project_id`를 전달합니다.
    - 프로젝트 기본 정보와 활성 멤버 목록을 함께 반환합니다.
    """
    project = _get_project_or_404(db, project_id)
    members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id, ProjectMember.left_at.is_(None)).all()
    member_user_ids = [member.user_id for member in members]
    member_users = (
        {user.id: user for user in db.query(User).filter(User.id.in_(member_user_ids)).all()}
        if member_user_ids
        else {}
    )
    
    # Get tech_stack from project_skills
    tech_stack = db.query(Skill.name).join(
        ProjectSkill, ProjectSkill.skill_id == Skill.id
    ).filter(ProjectSkill.project_id == project_id).all()
    tech_stack_list = [s[0] for s in tech_stack]
    source_idea = db.get(Idea, project.idea_id) if project.idea_id else None
    idea_parts = _extract_idea_description_parts(source_idea.description if source_idea else "")
    project_parts = _extract_idea_description_parts(project.description)
    
    return success_response(
        data={
            "id": project.id,
            "idea_id": project.idea_id,
            "title": project.title,
            "summary": project.summary,
            "description": project_parts["description"] or idea_parts["description"],
            "status": project.status,
            "difficulty": project.difficulty,
            "category": project.category,
            "domain": project.category,
            "progress_percent": float(project.progress_percent),
            "leader_id": project.leader_id,
            "currentMembers": len(members),
            "maxMembers": project.max_members,
            "max_members": project.max_members,
            "techStack": tech_stack_list,
            "tech_stack": tech_stack_list,
            "hashtags": source_idea.hashtags if source_idea else [],
            "expected_period": idea_parts["expected_period"] or project_parts["expected_period"],
            "preferred_members": idea_parts["preferred_members"] or project_parts["preferred_members"],
            "members": [
                _serialize_project_member(member, member_users.get(member.user_id))
                for member in members
            ],
        }
    )


@router.post("/{project_id}/applications", summary="프로젝트 지원", description="현재 사용자가 프로젝트에 지원합니다.")
async def apply_project(
    project_id: int,
    payload: ApplicationCreateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 지원 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정하고 message를 포함해 호출합니다.
    - 동일 프로젝트 중복 지원 시 `409`를 반환합니다.
    """
    project = _get_project_or_404(db, project_id)
    exists = db.query(Application).filter(Application.project_id == project_id, Application.applicant_id == current_user_id).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Application already exists")

    app_obj = Application(project_id=project_id, applicant_id=current_user_id, message=payload.message, status="pending")
    db.add(app_obj)
    db.flush()
    if project.leader_id != current_user_id:
        applicant = db.get(User, current_user_id)
        applicant_name = applicant.nickname if applicant else "새 지원자"
        db.add(
            Notification(
                user_id=project.leader_id,
                type="application_received",
                title="새 프로젝트 지원이 도착했습니다",
                body=f"{applicant_name}님이 '{project.title}' 프로젝트에 지원했습니다.",
                data={
                    **_project_notification_data(project_id),
                    "application_id": app_obj.id,
                    "applicant_id": current_user_id,
                },
            )
        )
    db.commit()
    db.refresh(app_obj)
    return success_response(data={"id": app_obj.id, "status": app_obj.status})


@router.get("/{project_id}/applications", summary="지원자 목록", description="프로젝트 리더가 지원자 목록을 조회합니다.")
async def list_applications(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """지원자 목록 조회 API(리더 전용).

    Swagger 테스트 방법:
    - 프로젝트 리더 계정으로 호출합니다.
    - 리더 권한이 없으면 `403`을 반환합니다.
    """
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)
    apps = db.query(Application).filter(Application.project_id == project_id).order_by(Application.id.desc()).all()
    applicant_ids = [app.applicant_id for app in apps]
    applicants = (
        {user.id: user for user in db.query(User).filter(User.id.in_(applicant_ids)).all()}
        if applicant_ids
        else {}
    )
    return success_response(
        data=[
            {
                "id": app.id,
                "applicant_id": app.applicant_id,
                "message": app.message,
                "status": app.status,
                "applicant": {
                    "id": applicants[app.applicant_id].id,
                    "nickname": applicants[app.applicant_id].nickname,
                    "name": applicants[app.applicant_id].name,
                    "email": applicants[app.applicant_id].email,
                    "bio": applicants[app.applicant_id].bio,
                    "avatar_url": applicants[app.applicant_id].avatar_url,
                }
                if app.applicant_id in applicants
                else None,
            }
            for app in apps
        ]
    )


@router.patch("/{project_id}/applications/{application_id}", summary="지원 승인/거절", description="리더가 지원 상태를 accepted/rejected로 변경합니다.")
async def decide_application(
    project_id: int,
    application_id: int,
    payload: ApplicationDecisionRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """지원 승인/거절 API(리더 전용).

    Swagger 테스트 방법:
    - body `status`는 accepted/rejected만 허용됩니다.
    - accepted면 프로젝트 멤버 테이블에 자동 반영됩니다.
    """
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)

    app_obj = db.get(Application, application_id)
    if app_obj is None or app_obj.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    if app_obj.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending applications can be decided")

    decision = payload.status
    if decision not in {"accepted", "rejected"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="status must be accepted or rejected")

    if decision == "accepted":
        active_member_count = (
            db.query(ProjectMember)
            .filter(
                ProjectMember.project_id == project_id,
                ProjectMember.left_at.is_(None),
            )
            .count()
        )
        if project.max_members and active_member_count >= project.max_members:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project is already full")

    app_obj.status = decision
    app_obj.decided_by = current_user_id
    app_obj.decided_at = datetime.now(timezone.utc)

    if decision == "accepted":
        exists_member = (
            db.query(ProjectMember)
            .filter(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == app_obj.applicant_id,
            )
            .first()
        )

        if exists_member is None:
            db.add(
                ProjectMember(
                    project_id=project_id,
                    user_id=app_obj.applicant_id,
                    role_in_project=payload.role_in_project or "member",
                )
            )

    decision_label = "승인" if decision == "accepted" else "거절"
    db.add(
        Notification(
            user_id=app_obj.applicant_id,
            type="application_decided",
            title=f"프로젝트 지원이 {decision_label}되었습니다",
            body=f"'{project.title}' 프로젝트 지원이 {decision_label}되었습니다.",
            data={
                **_project_notification_data(project_id),
                "application_id": app_obj.id,
                "decision": decision,
            },
        )
    )

    db.commit() 
    return success_response(data={"id": app_obj.id, "status": app_obj.status})


@router.patch("/{project_id}", summary="프로젝트 수정", description="리더가 프로젝트 메타데이터를 부분 수정합니다.")
async def update_project(
    project_id: int,
    payload: ProjectUpdateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 메타데이터 수정 API.

    Swagger 테스트 방법:
    - 리더 계정으로 호출하고 수정할 필드만 전달합니다.
    - partial update 방식으로 동작합니다.
    """
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)

    payload_data = payload.model_dump(exclude_none=True)
    tech_stack = payload_data.pop("tech_stack", None)
    hashtags = payload_data.pop("hashtags", None)
    expected_period = payload_data.pop("expected_period", None)
    preferred_members = payload_data.pop("preferred_members", None)

    for field, value in payload_data.items():
        setattr(project, field, value)

    if tech_stack is not None:
        _sync_project_skills(db, project_id, tech_stack)

    source_idea = db.get(Idea, project.idea_id) if project.idea_id else None
    if source_idea is not None:
        if "title" in payload_data:
            source_idea.title = project.title
        if "summary" in payload_data:
            source_idea.summary = project.summary
        if "difficulty" in payload_data:
            source_idea.difficulty = project.difficulty
        if "category" in payload_data:
            source_idea.domain = project.category
        if "max_members" in payload_data:
            source_idea.required_members = project.max_members
        if tech_stack is not None:
            source_idea.tech_stack = tech_stack
        if hashtags is not None:
            source_idea.hashtags = hashtags

        idea_parts = _extract_idea_description_parts(source_idea.description)
        clean_description = payload_data.get("description", idea_parts["description"])
        source_idea.description = _compose_idea_description(
            clean_description,
            expected_period if expected_period is not None else idea_parts["expected_period"],
            preferred_members if preferred_members is not None else idea_parts["preferred_members"],
        )

    db.commit()
    db.refresh(project)
    return success_response(data={"id": project.id, "updated": True})


@router.delete("/{project_id}", summary="프로젝트 삭제", description="프로젝트를 soft delete 처리합니다.")
async def delete_project(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 삭제 API(soft delete).

    Swagger 테스트 방법:
    - 리더 계정으로 호출합니다.
    - 실제 삭제 대신 deleted_at을 기록합니다.
    """
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)
    if project.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Completed projects cannot be discarded",
        )
    if project.idea_id is not None and project.status != "completed":
        reward_project_recycled(db, project)
    project.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return success_response(data={"deleted": True, "id": project_id})


@router.post("/{project_id}/revert-to-idea", summary="프로젝트를 아이디어로 되돌리기", description="프로젝트를 아이디어로 되돌립니다(프로젝트 soft delete, 원본 Idea 복원).")
async def revert_project_to_idea(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 → 아이디어 되돌리기 API.

    목적:
    - 프로젝트가 실패하거나 폐기될 때 원본 아이디어로 상태 복원
    - 프로젝트는 soft delete, 원본 Idea의 converted_to_project_id 제거

    Swagger 테스트 방법:
    - 리더 계정으로 호출합니다.
    - path의 `project_id`를 전달합니다.

    권한/검증:
    - 프로젝트 리더만 가능 (403)
    - 프로젝트가 없으면 404
    - 원본 Idea가 없으면 경고만 출력 (프로젝트는 삭제)

    흐름:
    1. 프로젝트 검증 (존재, 리더 확인)
    2. 원본 Idea가 있으면 converted_to_project_id 제거
    3. 프로젝트 soft delete
    """
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)
    if project.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Completed projects cannot be discarded",
        )
    
    # 원본 Idea 복원 (있으면)
    idea_reverted = False
    if project.idea_id is not None:
        idea = db.get(Idea, project.idea_id)
        if idea is not None and idea.deleted_at is None:
            # Idea의 변환 기록 제거 및 투척 표시
            idea.converted_to_project_id = None
            idea.is_discarded = True
            idea_reverted = True

    if project.idea_id is not None:
        reward_project_recycled(db, project)
    
    # 프로젝트 soft delete
    project.deleted_at = datetime.now(timezone.utc)
    db.commit()
    
    return success_response(
        data={
            "reverted": True,
            "project_id": project_id,
            "idea_id": project.idea_id,
            "idea_reverted": idea_reverted,
        }
    )


@router.patch("/{project_id}/status", summary="프로젝트 상태 변경", description="planning/in_progress/paused/completed 등 상태를 갱신합니다.")
async def update_project_status(
    project_id: int,
    payload: ProjectStatusUpdateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 상태 변경 API.

    Swagger 테스트 방법:
    - 리더 계정으로 호출합니다.
    - body의 status 값으로 planning/in_progress/paused/completed 등을 전달합니다.
    """
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)

    previous_status = project.status
    project.status = payload.status

    if previous_status != "in_progress" and payload.status == "in_progress":
        project.started_at = datetime.now(timezone.utc)
        reward_project_started(db, project)
    if previous_status != "completed" and payload.status == "completed":
        completed_at = datetime.now(timezone.utc)
        project.ended_at = completed_at
        project.completed_at = completed_at
        reward_project_completed(db, project)
        members = (
            db.query(ProjectMember)
            .filter(ProjectMember.project_id == project_id, ProjectMember.left_at.is_(None))
            .all()
        )
        for member in members:
            db.add(
                Notification(
                    user_id=member.user_id,
                    type="project_completed_review_requested",
                    title="팀원 평가를 남겨주세요",
                    body=f"'{project.title}' 프로젝트가 완료되었습니다. 함께한 팀원들을 평가해주세요.",
                    data={
                        **_project_notification_data(project_id),
                        "project_id": project_id,
                        "action": "review_teammates",
                    },
                )
            )

    db.commit()
    return success_response(data={"id": project.id, "status": project.status})


@router.post("/{project_id}/milestones", summary="마일스톤 생성", description="프로젝트 마일스톤을 생성합니다.")
async def create_milestone(
    project_id: int,
    payload: MilestoneCreateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """마일스톤 생성 API(리더 전용)."""
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)
    milestone = ProjectMilestone(
        project_id=project_id,
        title=payload.title,
        description=payload.description,
        due_date=payload.due_date,
        is_done=payload.is_done,
    )
    db.add(milestone)
    db.commit()
    db.refresh(milestone)
    return success_response(data={"id": milestone.id, "title": milestone.title})


@router.patch("/{project_id}/milestones/{milestone_id}", summary="마일스톤 수정", description="마일스톤 제목/설명/완료 상태를 수정합니다.")
async def update_milestone(
    project_id: int,
    milestone_id: int,
    payload: MilestoneUpdateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """마일스톤 수정 API(리더 전용)."""
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)

    milestone = db.get(ProjectMilestone, milestone_id)
    if milestone is None or milestone.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(milestone, field, value)

    db.commit()
    return success_response(data={"id": milestone.id, "updated": True})


@router.get("/{project_id}/progress", summary="진행률 조회", description="Todo 기반 프로젝트 진행률을 계산해 반환합니다.")
async def get_project_progress(project_id: int, db: Session = Depends(get_db)) -> dict:
    """프로젝트 진행률 조회 API.

    Swagger 테스트 방법:
    - Todo 전체/완료 개수를 기준으로 진행률을 계산해 반환합니다.
    """
    _get_project_or_404(db, project_id)
    total = db.query(func.count(Todo.id)).filter(Todo.project_id == project_id).scalar() or 0
    done = db.query(func.count(Todo.id)).filter(Todo.project_id == project_id, Todo.status == "done").scalar() or 0
    percent = round((done / total) * 100, 2) if total else 0.0
    return success_response(data={"project_id": project_id, "todo_total": total, "todo_done": done, "progress_percent": percent})


@router.post("/{project_id}/recruitments", summary="재모집 포지션 생성", description="리더가 결원 포지션에 대한 재모집을 생성합니다.")
async def create_recruitment(
    project_id: int,
    payload: RecruitmentCreateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """재모집 포지션 생성 API(리더 전용).

    Swagger 테스트 방법:
    - body `position_name`은 필수입니다.
    - `deadline`은 선택입니다.
    """
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)

    recruitment = ProjectRecruitment(
        project_id=project_id,
        position_name=payload.position_name,
        required_count=payload.required_count,
        category=payload.category,
        difficulty=payload.difficulty,
        summary=payload.summary,
        status=payload.status,
        deadline=payload.deadline,
        description=payload.description,
    )
    db.add(recruitment)
    db.commit()
    db.refresh(recruitment)
    return success_response(data=_build_recruitment_response_with_competition(db, recruitment))


@router.patch("/{project_id}/recruitments/{recruitment_id}", summary="재모집 수정", description="재모집의 상태/인원/설명/마감일을 갱신합니다.")
async def update_recruitment(
    project_id: int,
    recruitment_id: int,
    payload: RecruitmentUpdateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """재모집 포지션 수정 API(리더 전용)."""
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)

    recruitment = db.get(ProjectRecruitment, recruitment_id)
    if recruitment is None or recruitment.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recruitment not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(recruitment, field, value)

    db.commit()
    db.refresh(recruitment)
    return success_response(data=_build_recruitment_response_with_competition(db, recruitment))


@router.post("/{project_id}/invite", summary="멤버 초대", description="리더가 특정 유저를 프로젝트로 초대합니다.")
async def invite_user(
    project_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 멤버 초대 API(리더 전용).

    Swagger 테스트 방법:
    - body `invitee_id` 필수, `message` 선택 전달.
    """
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)

    invitee_id = payload.get("invitee_id")
    if not invitee_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invitee_id is required")

    invite = Invitation(
        project_id=project_id,
        inviter_id=current_user_id,
        invitee_id=invitee_id,
        message=payload.get("message"),
        status="pending",
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return success_response(data={"id": invite.id, "status": invite.status})


@router.post("/{project_id}/invite/{invite_id}/accept", summary="초대 수락", description="초대받은 사용자가 프로젝트 초대를 수락합니다.")
async def accept_invite(
    project_id: int,
    invite_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """초대 수락 API.

    Swagger 테스트 방법:
    - 초대받은 사용자 본인이 호출해야 하며, 수락 시 멤버가 자동 등록됩니다.
    """
    _get_project_or_404(db, project_id)
    invite = db.get(Invitation, invite_id)
    if invite is None or invite.project_id != project_id or invite.invitee_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    invite.status = "accepted"
    invite.decided_at = datetime.now(timezone.utc)
    exists_member = db.query(ProjectMember).filter(ProjectMember.project_id == project_id, ProjectMember.user_id == current_user_id).first()
    if exists_member is None:
        db.add(ProjectMember(project_id=project_id, user_id=current_user_id, role_in_project="member"))

    db.commit()
    return success_response(data={"id": invite.id, "status": invite.status})


@router.post("/{project_id}/invite/{invite_id}/reject", summary="초대 거절", description="초대받은 사용자가 프로젝트 초대를 거절합니다.")
async def reject_invite(
    project_id: int,
    invite_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """초대 거절 API.

    Swagger 테스트 방법:
    - 초대받은 사용자 본인이 호출해야 합니다.
    """
    _get_project_or_404(db, project_id)
    invite = db.get(Invitation, invite_id)
    if invite is None or invite.project_id != project_id or invite.invitee_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    invite.status = "rejected"
    invite.decided_at = datetime.now(timezone.utc)
    db.commit()
    return success_response(data={"id": invite.id, "status": invite.status})


@router.post("/{project_id}/members", summary="멤버 직접 추가", description="리더가 프로젝트 멤버를 직접 추가합니다.")
async def add_member(
    project_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """멤버 직접 추가 API(리더 전용).

    Swagger 테스트 방법:
    - body `user_id` 필수, `role_in_project` 선택 전달.
    """
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id is required")

    exists = db.query(ProjectMember).filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Member already exists")

    member = ProjectMember(project_id=project_id, user_id=user_id, role_in_project=payload.get("role_in_project", "member"))
    db.add(member)
    db.commit()
    return success_response(data={"project_id": project_id, "user_id": user_id})


@router.delete("/{project_id}/members/{member_id}", summary="멤버 제거", description="리더가 프로젝트 멤버를 제거합니다.")
async def remove_member(
    project_id: int,
    member_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """멤버 제거 API(리더 전용)."""
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)

    member = db.get(ProjectMember, member_id)
    if member is None or member.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    db.delete(member)
    db.commit()
    return success_response(data={"removed": True, "member_id": member_id})


@router.post("/{project_id}/todos", summary="Todo 생성", description="프로젝트 멤버가 Todo를 생성합니다.")
async def create_todo(
    project_id: int,
    payload: TodoCreateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """Todo 생성 API(프로젝트 멤버 전용)."""
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)

    todo = Todo(
        project_id=project_id,
        creator_id=current_user_id,
        assignee_id=payload.assignee_id,
        title=payload.title,
        description=payload.description,
        stage=payload.stage,
        status=payload.status,
        priority=payload.priority,
        due_date=payload.due_date,
    )
    db.add(todo)
    db.flush()

    assignee_ids = _normalize_assignee_ids(payload)
    _validate_todo_assignees(db, project_id, assignee_ids)
    _sync_todo_assignments(db, todo, assignee_ids)
    db.commit()
    db.refresh(todo)
    await _broadcast_todo_snapshot(db, project_id, todo, "todo.created")
    assignments = _serialize_todo_assignments(db, [todo.id]).get(todo.id, [])
    return success_response(data=_build_todo_response(todo, assignments))


@router.get("/{project_id}/todos", summary="Todo 목록", description="프로젝트 멤버가 Todo 목록을 조회합니다.")
async def list_todos(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """Todo 목록 조회 API(프로젝트 멤버 전용)."""
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)
    todos = db.query(Todo).filter(Todo.project_id == project_id).order_by(Todo.priority.asc(), Todo.id.asc()).all()
    assignments_by_todo = _serialize_todo_assignments(db, [todo.id for todo in todos])
    return success_response(
        data=[_build_todo_response(todo, assignments_by_todo.get(todo.id, [])) for todo in todos]
    )


@router.get("/{project_id}/todos/state", summary="Todo 확정 상태 조회", description="프로젝트 Todo 체크리스트 확정 여부를 조회합니다.")
async def get_todo_state(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """Todo 확정 상태 조회 API(프로젝트 멤버 전용)."""
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)
    return success_response(data=_build_todo_state_response(db, project_id))


@router.post("/{project_id}/todos/confirm", summary="Todo 체크리스트 확정", description="채팅방 Todo 체크리스트를 확정하여 채팅방에서는 읽기 전용으로 전환합니다.")
async def confirm_todo_list(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """Todo 확정 API(프로젝트 멤버 전용).

    확정 이후 수정/추가는 진행 관리 페이지에서 계속 가능합니다.
    """
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)

    marker = _get_todo_finalized_marker(db, project_id)
    if marker is None:
        db.add(
            ProjectMilestone(
                project_id=project_id,
                title=TODO_FINALIZED_MARKER_TITLE,
                description="Team Todo checklist finalized in chat room.",
                is_done=True,
            )
        )
        db.commit()

    await _broadcast_todo_state(db, project_id)
    return success_response(data=_build_todo_state_response(db, project_id))


@router.patch("/{project_id}/todos/{todo_id}", summary="Todo 수정", description="Todo 내용을 부분 수정하고 done 상태면 완료 시각을 기록합니다.")
async def update_todo(
    project_id: int,
    todo_id: int,
    payload: TodoUpdateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """Todo 수정 API(프로젝트 멤버 전용).

    Swagger 테스트 방법:
    - status를 done으로 바꾸면 completed_at이 자동 기록됩니다.
    """
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)
    todo = db.get(Todo, todo_id)
    if todo is None or todo.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")

    update_data = payload.model_dump(exclude_none=True)
    assignee_ids = _normalize_assignee_ids(payload)

    for field in ("title", "description", "stage", "status", "priority", "due_date"):
        if field in update_data:
            setattr(todo, field, update_data[field])

    if "assignee_id" in update_data or "assignee_ids" in update_data:
        _validate_todo_assignees(db, project_id, assignee_ids)
        _sync_todo_assignments(db, todo, assignee_ids)

    if todo.status == "done" and todo.completed_at is None:
        todo.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(todo)
    await _broadcast_todo_snapshot(db, project_id, todo, "todo.updated")
    assignments = _serialize_todo_assignments(db, [todo.id]).get(todo.id, [])
    return success_response(data=_build_todo_response(todo, assignments))


@router.post("/{project_id}/todos/ai-generate", summary="AI Todo 생성", description="프로젝트 상세와 최근 채팅을 바탕으로 Todo 목록을 생성합니다.")
async def generate_project_todos_with_ai(
    project_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)

    members = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.left_at.is_(None))
        .all()
    )
    member_ids = [member.user_id for member in members]
    member_users = (
        {user.id: user for user in db.query(User).filter(User.id.in_(member_ids)).all()}
        if member_ids
        else {}
    )

    room_id = payload.get("room_id")
    message_ids = payload.get("message_ids") or []
    limit = min(max(int(payload.get("limit", 12) or 12), 4), 20)
    messages_query = db.query(ChatMessage).join(ChatRoom, ChatRoom.id == ChatMessage.room_id).filter(
        ChatRoom.project_id == project_id,
    )
    if room_id:
        messages_query = messages_query.filter(ChatMessage.room_id == room_id)
    if message_ids:
        messages_query = messages_query.filter(ChatMessage.id.in_(message_ids))
        recent_messages = messages_query.order_by(ChatMessage.created_at.asc()).all()
    else:
        recent_messages = messages_query.order_by(ChatMessage.created_at.desc()).limit(50).all()
        recent_messages = list(reversed(recent_messages))

    context_text = _build_ai_todo_context(project, members, member_users, recent_messages)
    titles = (await _generate_ai_todo_titles(context_text, project))[:limit]

    existing_titles = {
        title.lower()
        for (title,) in db.query(Todo.title).filter(Todo.project_id == project_id).all()
    }
    max_priority = (
        db.query(func.max(Todo.priority))
        .filter(Todo.project_id == project_id)
        .scalar()
        or 0
    )

    created_todos: list[Todo] = []
    for index, raw_title in enumerate(titles, start=1):
        stage, title, description = _split_ai_todo_item(raw_title)
        if title.lower() in existing_titles:
            continue

        todo = Todo(
            project_id=project_id,
            creator_id=current_user_id,
            assignee_id=member_ids[0] if member_ids else None,
            title=title,
            description=description,
            stage=stage,
            status="todo",
            priority=max_priority + index,
        )
        db.add(todo)
        db.flush()
        _sync_todo_assignments(db, todo, member_ids)
        created_todos.append(todo)
        existing_titles.add(title.lower())

    db.commit()
    for todo in created_todos:
        db.refresh(todo)
        await _broadcast_todo_snapshot(db, project_id, todo, "todo.created")

    assignments_by_todo = _serialize_todo_assignments(db, [todo.id for todo in created_todos])
    return success_response(
        data=[
            _build_todo_response(todo, assignments_by_todo.get(todo.id, []))
            for todo in created_todos
        ]
    )


@router.patch("/{project_id}/todos/{todo_id}/done", summary="Todo 완료 토글", description="현재 사용자 할당분의 완료 상태를 토글합니다.")
async def toggle_todo_assignment_done(
    project_id: int,
    todo_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """Todo assignment 완료 토글 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.
    - path의 project_id, todo_id를 전달합니다.

    동작:
    - 요청 유저의 todo_assignments.is_done 를 true/false 토글합니다.
    - done 상태면 done_at 을 현재 시각으로 기록하고, false면 null로 되돌립니다.
    - 본인 assignment가 없으면 403을 반환합니다.
    """
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)

    todo = db.get(Todo, todo_id)
    if todo is None or todo.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")

    assignment = (
        db.query(TodoAssignment)
        .filter(TodoAssignment.todo_id == todo_id, TodoAssignment.user_id == current_user_id)
        .first()
    )
    if assignment is None:
        assignment = TodoAssignment(todo_id=todo_id, user_id=current_user_id, is_done=False)
        db.add(assignment)
        db.flush()

    next_done = todo.status != "done"
    todo.status = "done" if next_done else "todo"
    todo.completed_at = datetime.now(timezone.utc) if next_done else None
    assignment.is_done = next_done
    assignment.done_at = datetime.now(timezone.utc) if assignment.is_done else None
    db.commit()
    db.refresh(todo)
    db.refresh(assignment)

    assignments = _serialize_todo_assignments(db, [todo.id]).get(todo.id, [])
    await realtime_hub.broadcast_json(
        project_todo_channel(project_id),
        {
            "type": "todo.updated",
            "data": _build_todo_response(todo, assignments),
            "meta": {
                "assignment_id": assignment.id,
                "user_id": current_user_id,
                "is_done": assignment.is_done,
                "done_at": assignment.done_at.isoformat() if assignment.done_at else None,
            },
        },
    )

    return success_response(
        data={
            "todo_id": todo.id,
            "assignment_id": assignment.id,
            "user_id": current_user_id,
            "is_done": assignment.is_done,
            "done_at": assignment.done_at.isoformat() if assignment.done_at else None,
        }
    )


@router.delete("/{project_id}/todos/{todo_id}", summary="Todo 삭제", description="프로젝트 멤버가 Todo를 삭제합니다.")
async def delete_todo(
    project_id: int,
    todo_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """Todo 삭제 API(프로젝트 멤버 전용)."""
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)
    todo = db.get(Todo, todo_id)
    if todo is None or todo.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")
    db.delete(todo)
    db.commit()
    await realtime_hub.broadcast_json(
        project_todo_channel(project_id),
        {
            "type": "todo.deleted",
            "data": {"todo_id": todo_id, "project_id": project_id},
        },
    )
    return success_response(data={"deleted": True, "todo_id": todo_id})


@router.websocket("/{project_id}/todos/ws")
async def project_todos_websocket(
    websocket: WebSocket,
    project_id: int,
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
    if project is None or project.deleted_at is not None:
        await websocket.close(code=1008)
        return

    _ensure_project_member(db, project_id, current_user_id)

    channel = project_todo_channel(project_id)
    await realtime_hub.connect(channel, websocket)
    try:
        todos = db.query(Todo).filter(Todo.project_id == project_id).order_by(Todo.priority.asc(), Todo.id.asc()).all()
        assignments_by_todo = _serialize_todo_assignments(db, [todo.id for todo in todos])
        await websocket.send_json(
            {
                "type": "todo.snapshot",
                "data": [_build_todo_response(todo, assignments_by_todo.get(todo.id, [])) for todo in todos],
            }
        )
        await websocket.send_json(
            {
                "type": "todo.state.updated",
                "data": _build_todo_state_response(db, project_id),
            }
        )

        while True:
            payload = await websocket.receive_json()
            event_type = payload.get("type", "ping")

            if event_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if event_type == "todo.refresh":
                todos = db.query(Todo).filter(Todo.project_id == project_id).order_by(Todo.priority.asc(), Todo.id.asc()).all()
                assignments_by_todo = _serialize_todo_assignments(db, [todo.id for todo in todos])
                await websocket.send_json(
                    {
                        "type": "todo.snapshot",
                        "data": [_build_todo_response(todo, assignments_by_todo.get(todo.id, [])) for todo in todos],
                    }
                )
                await websocket.send_json(
                    {
                        "type": "todo.state.updated",
                        "data": _build_todo_state_response(db, project_id),
                    }
                )
                continue

            await websocket.send_json({"type": "error", "detail": "Unsupported event type"})
    except WebSocketDisconnect:
        pass
    finally:
        realtime_hub.disconnect(channel, websocket)


@router.post("/{project_id}/retrospectives", summary="회고 작성", description="프로젝트 멤버가 회고를 작성합니다.")
async def create_retrospective(
    project_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """회고 작성 API(프로젝트 멤버 전용).

    Swagger 테스트 방법:
    - body `title`은 필수입니다.
    """
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)
    if not payload.get("title"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="title is required")

    retro = Retrospective(
        project_id=project_id,
        author_id=current_user_id,
        title=payload["title"],
        what_went_well=payload.get("what_went_well"),
        what_went_badly=payload.get("what_went_badly"),
        lessons_learned=payload.get("lessons_learned"),
        next_actions=payload.get("next_actions"),
    )
    db.add(retro)
    db.commit()
    db.refresh(retro)
    return success_response(data={"id": retro.id, "title": retro.title})


@router.post(
    "/{project_id}/memoir/ai-refine",
    summary="Memoir AI 정제",
    description="느낀 점과 부족했던 점 텍스트를 AI가 정제해서 반환합니다.",
)
async def refine_memoir(
    project_id: int,
    payload: MemoirRefineRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)

    feelings = payload.felt_point.strip()
    shortcomings = payload.lacked_point.strip()
    if not feelings and not shortcomings:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="felt_point and lacked_point are required")

    refined_text = await _call_gemini_for_memoir_refine(feelings, shortcomings)
    return success_response(data={"refined_memoir": refined_text})


@router.get("/{project_id}/retrospectives", summary="회고 목록", description="프로젝트 멤버가 회고 목록을 조회합니다.")
async def list_retrospectives(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """회고 목록 조회 API(프로젝트 멤버 전용)."""
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)
    retros = db.query(Retrospective).filter(Retrospective.project_id == project_id).order_by(Retrospective.id.desc()).all()
    return success_response(data=[{"id": r.id, "title": r.title, "author_id": r.author_id} for r in retros])


@router.get("/{project_id}/retrospectives/{retrospective_id}", summary="회고 상세", description="프로젝트 멤버가 회고 상세를 조회합니다.")
async def get_retrospective(
    project_id: int,
    retrospective_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """회고 상세 조회 API(프로젝트 멤버 전용)."""
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)
    retro = db.get(Retrospective, retrospective_id)
    if retro is None or retro.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retrospective not found")
    return success_response(
        data={
            "id": retro.id,
            "title": retro.title,
            "what_went_well": retro.what_went_well,
            "what_went_badly": retro.what_went_badly,
            "lessons_learned": retro.lessons_learned,
            "next_actions": retro.next_actions,
        }
    )


@router.patch("/{project_id}/retrospectives/{retrospective_id}", summary="회고 수정", description="회고 작성자가 회고 내용을 수정합니다.")
async def update_retrospective(
    project_id: int,
    retrospective_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """회고 수정 API(작성자 전용)."""
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)
    retro = db.get(Retrospective, retrospective_id)
    if retro is None or retro.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retrospective not found")
    if retro.author_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only author can update")

    for field in ("title", "what_went_well", "what_went_badly", "lessons_learned", "next_actions"):
        if field in payload:
            setattr(retro, field, payload[field])

    db.commit()
    return success_response(data={"id": retro.id, "updated": True})


@router.post("/{project_id}/failure-stories", summary="실패 경험 등록", description="프로젝트 실패 경험을 기록합니다.")
async def create_failure_story(
    project_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """실패 경험 등록 API.

    Swagger 테스트 방법:
    - body `title`, `problem_summary`는 필수입니다.
    """
    _get_project_or_404(db, project_id)
    if not payload.get("title") or not payload.get("problem_summary"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="title and problem_summary are required")

    story = FailureStory(
        project_id=project_id,
        author_id=current_user_id,
        title=payload["title"],
        problem_summary=payload["problem_summary"],
        root_cause=payload.get("root_cause"),
        attempted_solutions=payload.get("attempted_solutions"),
        lessons_learned=payload.get("lessons_learned"),
        is_public=payload.get("is_public", True),
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    return success_response(data={"id": story.id, "title": story.title})


@router.get("/{project_id}/failure-stories", summary="프로젝트 실패 경험 목록", description="프로젝트 멤버가 실패 경험 목록을 조회합니다.")
async def list_failure_stories(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 실패 경험 목록 API(프로젝트 멤버 전용)."""
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)
    stories = db.query(FailureStory).filter(FailureStory.project_id == project_id).order_by(FailureStory.id.desc()).all()
    return success_response(data=[{"id": s.id, "title": s.title, "is_public": s.is_public} for s in stories])


@router.get("/failure-stories", summary="실패 경험 통합 탐색", description="공개된 실패 경험을 전체 조회합니다.")
async def list_all_failure_stories(db: Session = Depends(get_db)) -> dict:
    """실패 경험 통합 탐색 API.

    Swagger 테스트 방법:
    - 공개(`is_public=true`)된 실패 경험만 반환합니다.
    """
    stories = db.query(FailureStory).filter(FailureStory.is_public.is_(True)).order_by(FailureStory.id.desc()).all()
    return success_response(data=[{"id": s.id, "project_id": s.project_id, "title": s.title} for s in stories])


@router.post("/{project_id}/reviews", summary="프로젝트 리뷰 작성", description="프로젝트 멤버가 팀원을 리뷰하고 평점을 반영합니다.")
async def create_review(
    project_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 리뷰 작성 API(멤버 전용).

    Swagger 테스트 방법:
    - reviewee_id 필수, 자기 자신 리뷰는 불가합니다.
    - 중복 리뷰를 방지하며 생성 후 평점 집계를 재계산합니다.
    """
    project = _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)
    reviewee_id = payload.get("reviewee_id")
    if not reviewee_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="reviewee_id is required")
    if reviewee_id == current_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot review yourself")

    existing = (
        db.query(Review)
        .filter(Review.project_id == project_id, Review.reviewer_id == current_user_id, Review.reviewee_id == reviewee_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Review already exists")

    raw_comment = (
        payload.get("comment")
        or payload.get("message")
        or payload.get("review_message")
        or payload.get("content")
    )
    comment = raw_comment.strip() if isinstance(raw_comment, str) else raw_comment

    review = Review(
        project_id=project_id,
        reviewer_id=current_user_id,
        reviewee_id=reviewee_id,
        teamwork_score=payload.get("teamwork_score", 3),
        contribution_score=payload.get("contribution_score", 3),
        responsibility_score=payload.get("responsibility_score", 3),
        comment=comment or None,
    )
    db.add(review)
    db.flush()
    reviewer = db.get(User, current_user_id)
    reviewer_name = reviewer.nickname if reviewer else "팀원"
    db.add(
        Notification(
            user_id=reviewee_id,
            type="review_received",
            title="새 리뷰를 받았습니다",
            body=f"{reviewer_name}님이 '{project.title}' 프로젝트 리뷰를 남겼습니다.",
            data={
                **_project_notification_data(project_id),
                "review_id": review.id,
                "reviewer_id": current_user_id,
            },
        )
    )
    db.commit()
    db.refresh(review)

    # Aggregate is recomputed each time to keep rating endpoint accurate.
    aggregate_row = (
        db.query(
            func.count(Review.id),
            func.avg(Review.teamwork_score),
            func.avg(Review.contribution_score),
            func.avg(Review.responsibility_score),
        )
        .filter(Review.reviewee_id == reviewee_id)
        .one()
    )
    aggregate = db.get(UserRatingAggregate, reviewee_id)
    if aggregate is None:
        aggregate = UserRatingAggregate(user_id=reviewee_id)
        db.add(aggregate)

    aggregate.review_count = int(aggregate_row[0] or 0)
    aggregate.avg_teamwork = round(float(aggregate_row[1] or 0), 2)
    aggregate.avg_contribution = round(float(aggregate_row[2] or 0), 2)
    aggregate.avg_responsibility = round(float(aggregate_row[3] or 0), 2)
    db.commit()

    return success_response(data={"id": review.id})


@router.get("/{project_id}/reviews", summary="프로젝트 리뷰 목록", description="프로젝트 멤버가 리뷰 목록을 조회합니다.")
async def list_project_reviews(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 리뷰 목록 조회 API(멤버 전용)."""
    _get_project_or_404(db, project_id)
    _ensure_project_member(db, project_id, current_user_id)
    reviews = db.query(Review).filter(Review.project_id == project_id).order_by(Review.id.desc()).all()
    return success_response(
        data=[
            {
                "id": r.id,
                "reviewer_id": r.reviewer_id,
                "reviewee_id": r.reviewee_id,
                "teamwork_score": r.teamwork_score,
                "contribution_score": r.contribution_score,
                "responsibility_score": r.responsibility_score,
                "comment": r.comment,
            }
            for r in reviews
        ]
    )


@router.post("/{project_id}/complete-team", summary="팀 결성 완료", description="리더가 팀 결성을 완료하고 프로젝트를 시작합니다.")
async def complete_team(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """팀 결성 완료 API(리더 전용).

    동작:
    - 리더 권한 확인
    - project.status를 in_progress로 변경
    - 팀원들에게 알림 생성
    - 프로젝트 이름으로 팀 채팅방 생성
    - 팀 채팅방에 시스템 메시지 추가
    """
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)

    active_members = _get_active_project_member_ids(db, project_id)
    active_members.add(project.leader_id)

    project.status = "in_progress"

    for member_id in active_members:
        notification = Notification(
            user_id=member_id,
            type="project_update",
            title="팀 결성이 완료되었습니다",
            body=f"프로젝트 '{project.title}'의 팀 결성이 완료되어 프로젝트가 시작되었습니다.",
            data=_project_notification_data(project_id),
        )
        db.add(notification)

    team_room = (
        db.query(ChatRoom)
        .filter(
            ChatRoom.project_id == project_id,
            ChatRoom.name == project.title,
            ChatRoom.is_active.is_(True),
        )
        .first()
    )

    if team_room is None:
        team_room = ChatRoom(
            project_id=project_id,
            name=project.title,
            is_active=True,
        )
        db.add(team_room)
        db.flush()

    existing_chat_member_ids = {
        user_id
        for (user_id,) in db.query(ChatRoomMember.user_id)
        .filter(ChatRoomMember.room_id == team_room.id)
        .all()
    }
    for member_id in active_members:
        if member_id not in existing_chat_member_ids:
            db.add(ChatRoomMember(room_id=team_room.id, user_id=member_id))

    system_message = ChatMessage(
        room_id=team_room.id,
        sender_id=None,
        message="팀 결성이 완료되었습니다! 인사를 나누고 프로젝트를 시작하세요.",
    )
    db.add(system_message)
    db.flush()

    await realtime_hub.broadcast_json(
        chat_room_channel(team_room.id),
        {
            "type": "chat.message.created",
            "data": {
                "id": system_message.id,
                "room_id": system_message.room_id,
                "sender_id": None,
                "sender_nickname": "시스템",
                "sender_avatar_url": None,
                "message": system_message.message,
                "created_at": system_message.created_at.isoformat()
                if system_message.created_at
                else None,
            },
        },
    )

    db.commit()

    return success_response(
        data={
            "project_id": project_id,
            "status": "in_progress",
            "chat_room_id": team_room.id,
            "chat_room_name": team_room.name,
        }
    )

# ═══════════════════════════════════════════════════════════════
# ━━ Recruitment (경쟁률)
# ═══════════════════════════════════════════════════════════════

@router.get("/{project_id}/recruitments", summary="프로젝트 모집공고 목록 (경쟁률 포함)", description="경쟁률과 함께 프로젝트의 모든 모집공고를 조회합니다.")
async def list_recruitments(
    project_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트의 모집공고 목록 조회 (경쟁률 포함)"""
    project = _get_project_or_404(db, project_id)
    
    recruitments = db.query(ProjectRecruitment).filter(
        ProjectRecruitment.project_id == project_id
    ).all()
    
    data = [_build_recruitment_response_with_competition(db, rec) for rec in recruitments]
    
    return success_response(data=data)


@router.get("/{project_id}/recruitments/{recruitment_id}", summary="모집공고 상세 (경쟁률 포함)", description="경쟁률 정보와 함께 모집공고 상세를 조회합니다.")
async def get_recruitment(
    project_id: int,
    recruitment_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """모집공고 상세 조회 (경쟁률 포함)"""
    project = _get_project_or_404(db, project_id)
    
    recruitment = db.query(ProjectRecruitment).filter(
        ProjectRecruitment.id == recruitment_id,
        ProjectRecruitment.project_id == project_id,
    ).first()
    
    if not recruitment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recruitment not found")
    
    return success_response(data=_build_recruitment_response_with_competition(db, recruitment))


# ============================================
# 회고(Memoir) 관련 엔드포인트
# ============================================


@router.post(
    "/{project_id}/memoir",
    summary="회고 저장",
    description="프로젝트 회고를 저장합니다. (선택한 기술 스택, 분야, 느낀 점, 부족했던 점)",
)
async def create_memoir(
    project_id: int,
    payload: MemoirCreateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """회고 저장 API. 프로젝트의 모든 멤버가 작성할 수 있습니다."""
    project = _get_project_or_404(db, project_id)
    
    # 프로젝트 멤버 확인
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == current_user_id,
    ).first()
    
    if not member and project.leader_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a project member")
    
    # 기존 회고 확인 (중복 방지)
    existing = db.query(Retrospective).filter(
        Retrospective.project_id == project_id,
        Retrospective.author_id == current_user_id,
    ).first()
    
    if existing:
        existing.tech_stack = payload.tech_stack
        existing.domain = payload.domain
        existing.felt_point = payload.felt_point
        existing.lacked_point = payload.lacked_point
        db.commit()
        db.refresh(existing)
        return success_response(data=_build_memoir_response(existing))
    
    # 새로운 회고 생성
    memoir = Retrospective(
        project_id=project_id,
        author_id=current_user_id,
        title=f"Project {project_id} Memoir",
        tech_stack=payload.tech_stack,
        domain=payload.domain,
        felt_point=payload.felt_point,
        lacked_point=payload.lacked_point,
    )
    db.add(memoir)
    db.commit()
    db.refresh(memoir)
    
    return success_response(data=_build_memoir_response(memoir))


@router.get(
    "/{project_id}/memoir/me",
    summary="내 회고 조회",
    description="이 프로젝트에서 내가 작성한 회고를 조회합니다.",
)
async def get_my_memoir(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """내 회고 조회 API."""
    project = _get_project_or_404(db, project_id)
    
    memoir = db.query(Retrospective).filter(
        Retrospective.project_id == project_id,
        Retrospective.author_id == current_user_id,
    ).first()
    
    if not memoir:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memoir not found")
    
    return success_response(data=_build_memoir_response(memoir))


@router.get(
    "/{project_id}/memoirs",
    summary="프로젝트 전체 회고 조회",
    description="프로젝트의 모든 회고를 조회합니다. (리더 전용)",
)
async def get_project_memoirs(
    project_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 전체 회고 조회 API."""
    project = _get_project_or_404(db, project_id)
    _ensure_project_leader(project, current_user_id)
    
    memoirs = db.query(Retrospective).filter(
        Retrospective.project_id == project_id,
    ).all()
    
    return success_response(
        data=[
            {
                "id": m.id,
                "author_id": m.author_id,
                "tech_stack": m.tech_stack,
                "domain": m.domain,
                "felt_point": m.felt_point,
                "lacked_point": m.lacked_point,
                "ai_refined_felt": m.ai_refined_felt,
                "ai_refined_lacked": m.ai_refined_lacked,
                "created_at": m.created_at,
            }
            for m in memoirs
        ]
    )
