from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id
from app.models import AdoptionRequest
from app.models import Project

router = APIRouter()


@router.post("/projects/{project_id}/request", summary="프로젝트 이어받기 요청", description="프로젝트 이어받기 요청을 생성합니다.")
async def create_adoption_request(
    project_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 이어받기 요청 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.
    - path의 `project_id`는 대상 프로젝트 ID입니다.
    - body 예시: `{ "message": "기존 맥락을 이어받아 진행하겠습니다." }`

    권한/검증 규칙:
    - 프로젝트가 없으면 `404`를 반환합니다.
    - 요청 생성자는 현재 로그인 사용자로 자동 기록됩니다.

    응답:
    - 생성된 요청 ID와 상태(`pending`)를 반환합니다.
    """
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    request_obj = AdoptionRequest(
        project_id=project_id,
        requester_id=current_user_id,
        message=payload.get("message"),
        status="pending",
    )
    db.add(request_obj)
    db.commit()
    db.refresh(request_obj)
    return success_response(data={"id": request_obj.id, "status": request_obj.status})


@router.patch("/requests/{request_id}", summary="이어받기 요청 처리", description="프로젝트 리더가 이어받기 요청을 승인/거절합니다.")
async def decide_adoption_request(
    request_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """이어받기 요청 처리 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.
    - path의 `request_id`에 처리할 요청 ID를 전달합니다.
    - body 예시: `{ "status": "approved" }`

    권한/검증 규칙:
    - 요청 또는 프로젝트가 없으면 `404`를 반환합니다.
    - 프로젝트 리더만 처리 가능하며, 아니면 `403`을 반환합니다.
    - 허용 status 값: `approved`, `rejected`, `cancelled`

    처리 결과:
    - approved이면 프로젝트 리더를 요청자로 교체합니다.
    - 요청의 decided_by/decided_at을 기록합니다.
    """
    request_obj = db.get(AdoptionRequest, request_id)
    if request_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Adoption request not found")

    project = db.get(Project, request_obj.project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if project.leader_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only project leader can decide")

    decision = payload.get("status")
    if decision not in {"approved", "rejected", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="status must be approved/rejected/cancelled")

    request_obj.status = decision
    request_obj.decided_by = current_user_id
    request_obj.decided_at = datetime.now(timezone.utc)

    if decision == "approved":
        project.leader_id = request_obj.requester_id

    db.commit()
    return success_response(data={"id": request_obj.id, "status": request_obj.status})
