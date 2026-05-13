import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status, File, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id
from app.dependencies.auth import get_current_user_id_from_token
from app.models import Idea
from app.models import IdeaBookmark
from app.models import IdeaFile
from app.models import IdeaLike
from app.models import Notification
from app.models import Project
from app.models import ProjectMember
from app.models import ProjectSkill
from app.models import Skill
from app.schemas import IdeaCreateRequest
from app.schemas import IdeaUpdateRequest
from app.schemas import ProjectCreateRequest
from app.services.economy import spend_coins
from app.services.s3_upload import get_s3_service

router = APIRouter()


def _get_optional_user_id(authorization: str | None) -> int | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    try:
        return get_current_user_id_from_token(token)
    except HTTPException:
        return None


def _normalize_skill_name(skill_name: str) -> str:
    return re.sub(r"\s+", " ", skill_name.strip()).lower()


def _sync_project_skills_from_idea(db: Session, project_id: int, tech_stack: list[str]) -> None:
    existing_skill_ids = {
        skill_id
        for (skill_id,) in db.query(ProjectSkill.skill_id).filter(ProjectSkill.project_id == project_id).all()
    }
    for skill_name in tech_stack:
        normalized_name = _normalize_skill_name(skill_name)
        skill = db.query(Skill).filter(Skill.normalized_name == normalized_name).first()
        if skill is None:
            skill = Skill(name=skill_name.strip(), normalized_name=normalized_name)
            db.add(skill)
            db.flush()

        if skill.id not in existing_skill_ids:
            db.add(ProjectSkill(project_id=project_id, skill_id=skill.id))
            existing_skill_ids.add(skill.id)


def _project_notification_data(project_id: int) -> dict:
    return {
        "project_id": project_id,
        "url": f"/projects/{project_id}",
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


def _strip_idea_description_sections(description: str) -> str:
    marker_pattern = r"\n*\s*<b>\[\s*(?:예상 진행 기간|이런 분과 함께하고 싶어요)\s*\]</b>[\s\S]*$"
    return re.sub(marker_pattern, "", description or "").strip()


def _notify_project_registered(db: Session, project: Project) -> None:
    db.add(
        Notification(
            user_id=project.leader_id,
            type="project_update",
            title="프로젝트가 등록되었습니다",
            body=f"'{project.title}' 프로젝트가 생성되었습니다.",
            data=_project_notification_data(project.id),
        )
    )


def _create_project_from_idea(db: Session, idea: Idea, current_user_id: int) -> Project:
    project = Project(
        idea_id=idea.id,
        leader_id=current_user_id,
        title=idea.title,
        summary=idea.summary,
        description=_strip_idea_description_sections(idea.description),
        category=idea.domain,
        difficulty=idea.difficulty,
        status="planning",
        progress_percent=0,
        max_members=max(int(idea.required_members or 1), 1),
        is_public=idea.is_open,
    )
    db.add(project)
    db.flush()
    db.add(ProjectMember(project_id=project.id, user_id=current_user_id, role_in_project="leader"))
    _sync_project_skills_from_idea(db, project.id, list(idea.tech_stack or []))
    idea.converted_to_project_id = project.id
    spend_coins(
        db,
        user_id=current_user_id,
        amount=1,
        event_type="waterdrop.project.create",
        source_type="project",
        source_id=project.id,
        note=f"Project creation waterdrop for {project.title}",
    )
    _notify_project_registered(db, project)
    return project


@router.post("", summary="아이디어 생성", description="아이디어를 등록하면 즉시 프로젝트도 함께 생성합니다.")
async def create_idea(
    payload: IdeaCreateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """아이디어 생성 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.
    - body에 제목/설명/난이도/기술스택/해시태그를 포함해 호출합니다.
    - 생성 성공 시 Idea와 Project가 동시에 만들어집니다.
    """
    idea = Idea(
        author_id=current_user_id,
        title=payload.title,
        summary=payload.summary,
        description=_compose_idea_description(
            payload.description,
            payload.expected_period,
            payload.preferred_members,
        ),
        domain=payload.domain,
        tech_stack=payload.tech_stack,
        hashtags=payload.hashtags,
        difficulty=payload.difficulty,
        required_members=payload.required_members,
        is_open=payload.is_open,
    )
    db.add(idea)
    db.flush()

    project = _create_project_from_idea(db, idea, current_user_id)

    db.commit()
    db.refresh(idea)
    db.refresh(project)
    return success_response(
        data={
            "idea_id": idea.id,
            "project_id": project.id,
            "title": idea.title,
            "project_title": project.title,
            "converted": True,
        }
    )


@router.get("", summary="아이디어 목록", description="페이지네이션과 난이도 필터를 지원하는 아이디어 목록 조회 API입니다.")
async def list_ideas(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    difficulty: str | None = Query(default=None),
    discarded: bool | None = Query(default=None),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict:
    """아이디어 목록 조회 API.

    Swagger 테스트 방법:
    - query `page`, `size`, `difficulty`, `discarded`를 조합해 호출합니다.
    - `discarded=true`: 투척된 아이디어만 조회
    - `discarded=false`: 투척되지 않은 아이디어만 조회
    - `discarded` 미지정: 모든 아이디어 조회

    응답:
    - data에 아이디어 목록, meta에 page/size/total을 반환합니다.
    """
    query = db.query(Idea)
    query = query.filter(Idea.deleted_at.is_(None))
    if difficulty:
        query = query.filter(Idea.difficulty == difficulty)
    if discarded is not None:
        query = query.filter(Idea.is_discarded == discarded)

    total = query.count()
    ideas = query.order_by(Idea.created_at.desc()).offset((page - 1) * size).limit(size).all()
    idea_ids = [idea.id for idea in ideas]
    like_counts = dict(
        db.query(IdeaLike.idea_id, func.count(IdeaLike.id))
        .filter(IdeaLike.idea_id.in_(idea_ids))
        .group_by(IdeaLike.idea_id)
        .all()
    ) if idea_ids else {}
    bookmark_counts = dict(
        db.query(IdeaBookmark.idea_id, func.count(IdeaBookmark.id))
        .filter(IdeaBookmark.idea_id.in_(idea_ids))
        .group_by(IdeaBookmark.idea_id)
        .all()
    ) if idea_ids else {}

    current_user_id = _get_optional_user_id(authorization)
    liked_idea_ids: set[int] = set()
    bookmarked_idea_ids: set[int] = set()
    if current_user_id and idea_ids:
        liked_idea_ids = {
            idea_id
            for (idea_id,) in db.query(IdeaLike.idea_id)
            .filter(IdeaLike.user_id == current_user_id, IdeaLike.idea_id.in_(idea_ids))
            .all()
        }
        bookmarked_idea_ids = {
            idea_id
            for (idea_id,) in db.query(IdeaBookmark.idea_id)
            .filter(IdeaBookmark.user_id == current_user_id, IdeaBookmark.idea_id.in_(idea_ids))
            .all()
        }

    return success_response(
        data=[
            {
            "id": idea.id,
            "project_id": idea.converted_to_project_id,
            "converted_to_project_id": idea.converted_to_project_id,
            "title": idea.title,
            "summary": idea.summary,
            "tech_stack": idea.tech_stack,
            "hashtags": idea.hashtags,
            "domain": idea.domain,
            "difficulty": idea.difficulty,
            "is_open": idea.is_open,
            "is_discarded": idea.is_discarded,
            "like_count": int(like_counts.get(idea.id, 0)),
            "bookmark_count": int(bookmark_counts.get(idea.id, 0)),
            "is_liked": idea.id in liked_idea_ids,
            "is_bookmarked": idea.id in bookmarked_idea_ids,
            "created_at": idea.created_at,
        }
            for idea in ideas
        ],
        meta={"page": page, "size": size, "total": total},
    )


@router.get("/{idea_id}", summary="아이디어 상세", description="아이디어 상세 정보를 조회합니다.")
async def get_idea(idea_id: int, db: Session = Depends(get_db)) -> dict:
    """아이디어 상세 조회 API.

    Swagger 테스트 방법:
    - path의 `idea_id`를 전달합니다.

    검증:
    - 아이디어가 없거나 삭제 상태면 `404`를 반환합니다.
    """
    idea = db.get(Idea, idea_id)
    if idea is None or idea.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found")
    return success_response(
        data={
            "id": idea.id,
            "author_id": idea.author_id,
            "title": idea.title,
            "summary": idea.summary,
            "description": idea.description,
            "domain": idea.domain,
            "tech_stack": idea.tech_stack,
            "hashtags": idea.hashtags,
            "difficulty": idea.difficulty,
            "required_members": idea.required_members,
            "is_open": idea.is_open,
        },
    )


@router.post("/{idea_id}/view", summary="아이디어 열람 물방울 사용", description="아이디어 상세 열람 전에 물방울 1방울을 사용합니다.")
async def spend_for_idea_view(
    idea_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    idea = db.get(Idea, idea_id)
    if idea is None or idea.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found")

    balance = spend_coins(
        db,
        user_id=current_user_id,
        amount=1,
        event_type="waterdrop.idea.view",
        source_type="idea",
        source_id=idea.id,
        note=f"Idea view waterdrop for {idea.title}",
    )
    db.commit()

    return success_response(data={"idea_id": idea.id, "waterdrop_balance": balance, "coin_balance": balance})


@router.patch("/{idea_id}", summary="아이디어 수정", description="작성자 본인이 아이디어 필드를 부분 수정합니다.")
async def update_idea(
    idea_id: int,
    payload: IdeaUpdateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """아이디어 수정 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.
    - body에 수정할 필드만 전달하는 partial update 방식입니다.

    권한/검증:
    - 작성자만 수정할 수 있으며 아니면 `403`을 반환합니다.
    """
    idea = db.get(Idea, idea_id)
    if idea is None or idea.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found")
    if idea.author_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only author can update")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(idea, field, value)
    db.commit()
    db.refresh(idea)
    return success_response(data={"id": idea.id, "updated": True})


@router.delete("/{idea_id}", summary="아이디어 삭제", description="작성자 본인이 아이디어를 soft delete 합니다.")
async def delete_idea(
    idea_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """아이디어 삭제 API(soft delete).

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.

    권한/검증:
    - 작성자만 삭제 가능
    - 실제 row 삭제 대신 deleted_at을 기록합니다.
    """
    idea = db.get(Idea, idea_id)
    if idea is None or idea.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found")
    if idea.author_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only author can delete")
    idea.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return success_response(data={"deleted": True, "id": idea_id})


@router.post("/{idea_id}/bookmark", summary="아이디어 북마크", description="아이디어를 북마크 목록에 추가합니다.")
async def bookmark_idea(
    idea_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """아이디어 북마크 추가 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.

    검증:
    - 대상 아이디어가 없으면 `404`
    - 이미 북마크된 경우 `409`
    """
    idea = db.get(Idea, idea_id)
    if idea is None or idea.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found")
    if db.query(IdeaBookmark).filter(IdeaBookmark.user_id == current_user_id, IdeaBookmark.idea_id == idea_id).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already bookmarked")
    bookmark = IdeaBookmark(user_id=current_user_id, idea_id=idea_id)
    db.add(bookmark)
    db.commit()
    return success_response(data={"bookmarked": True, "idea_id": idea_id})


@router.delete("/{idea_id}/bookmark", summary="아이디어 북마크 해제", description="아이디어 북마크를 해제합니다.")
async def unbookmark_idea(
    idea_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """아이디어 북마크 해제 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.

    검증:
    - 북마크 매핑이 없으면 `404`
    """
    bookmark = db.query(IdeaBookmark).filter(IdeaBookmark.user_id == current_user_id, IdeaBookmark.idea_id == idea_id).first()
    if bookmark is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bookmark not found")
    db.delete(bookmark)
    db.commit()
    return success_response(data={"bookmarked": False, "idea_id": idea_id})


@router.post("/{idea_id}/like", summary="아이디어 좋아요", description="아이디어에 좋아요를 추가합니다.")
async def like_idea(
    idea_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """아이디어 좋아요 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.

    검증:
    - 아이디어가 없으면 `404`
    - 이미 좋아요한 경우 `409`
    """
    idea = db.get(Idea, idea_id)
    if idea is None or idea.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found")
    if db.query(IdeaLike).filter(IdeaLike.user_id == current_user_id, IdeaLike.idea_id == idea_id).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already liked")
    like = IdeaLike(user_id=current_user_id, idea_id=idea_id)
    db.add(like)
    db.commit()
    return success_response(data={"liked": True, "idea_id": idea_id})


@router.delete("/{idea_id}/like", summary="아이디어 좋아요 취소", description="아이디어 좋아요를 취소합니다.")
async def unlike_idea(
    idea_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """아이디어 좋아요 취소 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.

    검증:
    - 좋아요 매핑이 없으면 `404`
    """
    like = db.query(IdeaLike).filter(IdeaLike.user_id == current_user_id, IdeaLike.idea_id == idea_id).first()
    if like is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Like not found")
    db.delete(like)
    db.commit()
    return success_response(data={"liked": False, "idea_id": idea_id})


@router.post("/{idea_id}/convert-to-project", summary="아이디어를 프로젝트로 전환", description="인원이 모인 아이디어를 프로젝트로 전환합니다. 작성자만 가능합니다.")
async def convert_idea_to_project(
    idea_id: int,
    payload: ProjectCreateRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """아이디어 → 프로젝트 전환 API.

    목적:
    - 아이디어 등록 후 인원이 모이면 프로젝트로 전환하는 워크플로우 지원
    - 원본 Idea는 converted_to_project_id로 추적

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.
    - path의 `idea_id`를 전달하고 ProjectCreateRequest body를 전달합니다.

    권한/검증:
    - 아이디어 작성자만 변환 가능 (403)
    - 아이디어가 없으면 404
    - 이미 전환된 아이디어면 409

    흐름:
    1. 아이디어 검증 (존재, 미삭제, 소유권)
    2. 프로젝트 생성 (title, description은 Idea에서 복사 가능)
    3. 전환 기록 (Idea.converted_to_project_id 설정)
    4. 리더 멤버 자동 등록
    """
    # 아이디어 검증
    idea = db.get(Idea, idea_id)
    if idea is None or idea.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found")
    
    if idea.author_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only idea author can convert to project")
    
    if idea.converted_to_project_id is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This idea has already been converted to a project")
    
    # 프로젝트 생성 및 기술 스택 동기화
    project = Project(
        idea_id=idea_id,
        leader_id=current_user_id,
        title=payload.title,
        summary=payload.summary,
        description=_strip_idea_description_sections(payload.description),
        category=payload.category,
        difficulty=payload.difficulty,
        status=payload.status,
        progress_percent=payload.progress_percent,
        max_members=payload.max_members,
        is_public=payload.is_public,
    )
    db.add(project)
    db.flush()
    db.add(ProjectMember(project_id=project.id, user_id=current_user_id, role_in_project="leader"))
    _sync_project_skills_from_idea(db, project.id, list(idea.tech_stack or []))
    idea.converted_to_project_id = project.id
    spend_coins(
        db,
        user_id=current_user_id,
        amount=1,
        event_type="waterdrop.project.create",
        source_type="project",
        source_id=project.id,
        note=f"Project creation waterdrop for {project.title}",
    )
    _notify_project_registered(db, project)
    
    db.commit()
    db.refresh(project)
    db.refresh(idea)
    
    return success_response(
        data={
            "project_id": project.id,
            "project_title": project.title,
            "idea_id": idea.id,
            "idea_title": idea.title,
            "converted": True,
        }
    )


@router.post("/{idea_id}/pickup", summary="버려진 아이디어 줍기", description="영감의 샘에 버려진 아이디어를 다른 사용자가 새 프로젝트로 이어받습니다.")
async def pickup_discarded_idea(
    idea_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """버려진 아이디어 줍기 API.

    목적:
    - 프로젝트에서 되돌려져 `is_discarded=True`가 된 아이디어를 타인이 재활용
    - 원작성자는 자기 아이디어를 다시 주울 수 없음
    - 이미 프로젝트에 연결된 아이디어는 중복으로 주울 수 없음

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.
    - path의 `idea_id`를 전달합니다.

    흐름:
    1. 아이디어 존재/미삭제 검증
    2. discarded 상태인지 검증
    3. 프로젝트 미연결 상태인지 검증
    4. 원작성자가 아닌지 검증
    5. 새 Project 생성, 현재 사용자를 leader로 등록
    6. converted_to_project_id 연결 및 is_discarded=False 처리
    """
    idea = db.get(Idea, idea_id)
    if idea is None or idea.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found")

    if not idea.is_discarded:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only discarded ideas can be picked up")

    if idea.converted_to_project_id is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This idea is already connected to a project")

    if idea.author_id == current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot pick up your own idea")

    project = _create_project_from_idea(db, idea, current_user_id)
    idea.is_discarded = False

    db.commit()
    db.refresh(project)
    db.refresh(idea)

    return success_response(
        data={
            "project_id": project.id,
            "project_title": project.title,
            "idea_id": idea.id,
            "idea_title": idea.title,
            "picked_up": True,
        }
    )


# ═══════════════════════════════════════════════════════════════
# ━━ File Upload
# ═══════════════════════════════════════════════════════════════

@router.post("/{idea_id}/files", summary="아이디어에 파일 첨부", description="아이디어에 파일을 업로드합니다. 최대 50MB.")
async def upload_idea_file(
    idea_id: int,
    file: UploadFile = File(...),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
    s3_service=Depends(get_s3_service),
) -> dict:
    """아이디어에 파일 업로드"""
    idea = db.get(Idea, idea_id)
    if not idea or idea.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found")

    # 권한 검증: 아이디어 작성자만 파일 업로드 가능
    if idea.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only author can upload files")

    # Read file content
    file_content = await file.read()
    
    # Upload to S3
    upload_result = await s3_service.upload_file(
        file_content=file_content,
        filename=file.filename or "file",
        file_type=file.content_type or "application/octet-stream",
        folder="ideas",
    )

    # Save file record to database
    file_record = IdeaFile(
        idea_id=idea_id,
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
            "idea_id": file_record.idea_id,
            "filename": file_record.filename,
            "file_size": file_record.file_size,
            "file_type": file_record.file_type,
            "s3_url": file_record.s3_url,
            "uploaded_at": file_record.created_at,
        },
    )


@router.get("/{idea_id}/files", summary="아이디어 첨부 파일 조회", description="아이디어의 첨부 파일 목록을 조회합니다.")
async def list_idea_files(
    idea_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """아이디어의 모든 첨부 파일 조회"""
    idea = db.get(Idea, idea_id)
    if not idea or idea.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found")

    files = db.query(IdeaFile).filter(
        IdeaFile.idea_id == idea_id,
        IdeaFile.deleted_at.is_(None),
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


@router.delete("/{idea_id}/files/{file_id}", summary="아이디어 첨부 파일 삭제", description="아이디어의 첨부 파일을 삭제합니다.")
async def delete_idea_file(
    idea_id: int,
    file_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
    s3_service=Depends(get_s3_service),
) -> dict:
    """아이디어 첨부 파일 삭제 (소프트 삭제)"""
    file_record = db.get(IdeaFile, file_id)
    if not file_record or file_record.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    # 권한 검증: 아이디어 작성자 또는 파일 업로드자만 삭제 가능
    idea = db.get(Idea, idea_id)
    if file_record.uploaded_by != current_user_id and idea.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    # S3에서 파일 삭제
    await s3_service.delete_file(file_record.s3_key)

    # DB에서 소프트 삭제
    from sqlalchemy import func
    file_record.deleted_at = func.now()
    db.commit()

    return success_response(data={"deleted": True, "file_id": file_id})
