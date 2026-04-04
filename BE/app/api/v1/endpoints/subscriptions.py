from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id
from app.models import PaymentEvent
from app.models import SubscriptionPlan
from app.models import UserSubscription

router = APIRouter()


@router.get("/plans", summary="구독 플랜 목록", description="활성화된 구독 플랜 목록을 조회합니다.")
async def list_subscription_plans(db: Session = Depends(get_db)) -> dict:
    """구독 플랜 목록 조회 API.

    Swagger 테스트 방법:
    - 인증 없이 호출 가능합니다.
    - 활성 플랜만 가격 오름차순으로 반환됩니다.
    """
    plans = db.query(SubscriptionPlan).filter(SubscriptionPlan.is_active.is_(True)).order_by(SubscriptionPlan.price_krw.asc()).all()
    return success_response(data=[{"id": p.id, "code": p.code, "name": p.name, "price_krw": p.price_krw, "cycle": p.cycle} for p in plans])


@router.post("/checkout", summary="구독 결제 세션 생성", description="플랜 ID를 받아 사용자 구독을 생성합니다.")
async def create_checkout(
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """구독 결제 세션 생성 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.
    - body에 `plan_id`를 전달합니다.
    - 선택값 `external_subscription_id`를 함께 넣을 수 있습니다.

    검증:
    - plan_id 누락 시 `400`
    - 플랜이 없으면 `404`
    """
    plan_id = payload.get("plan_id")
    if not plan_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="plan_id is required")
    if db.get(SubscriptionPlan, plan_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    now = datetime.now(timezone.utc)
    subscription = UserSubscription(
        user_id=current_user_id,
        plan_id=plan_id,
        status="active",
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
        external_subscription_id=payload.get("external_subscription_id"),
    )
    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    return success_response(data={"subscription_id": subscription.id, "status": subscription.status})


@router.post("/webhook", summary="결제 웹훅 수신", description="결제사 이벤트를 수신하고 저장합니다.")
async def payment_webhook(payload: dict = Body(default={}), db: Session = Depends(get_db)) -> dict:
    """결제 웹훅 수신 API.

    Swagger 테스트 방법:
    - body에 `provider_event_id`를 포함해야 합니다.
    - payload 전체가 DB에 기록되며 processed_at이 설정됩니다.

    검증:
    - provider_event_id 누락 시 `400`
    """
    provider_event_id = payload.get("provider_event_id")
    if not provider_event_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="provider_event_id is required")

    event = PaymentEvent(
        user_subscription_id=payload.get("user_subscription_id"),
        provider=payload.get("provider", "manual"),
        provider_event_id=provider_event_id,
        event_type=payload.get("event_type", "unknown"),
        payload=payload,
        processed_at=datetime.now(timezone.utc),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return success_response(data={"event_id": event.id, "processed": True})


@router.get("/me", summary="내 구독 상태", description="현재 로그인한 사용자의 최신 구독 상태를 조회합니다.")
async def get_my_subscription(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """내 구독 상태 조회 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.
    - 가장 최근 구독 1건을 반환합니다.

    검증:
    - 구독 데이터가 없으면 `404`
    """
    subscription = (
        db.query(UserSubscription)
        .filter(UserSubscription.user_id == current_user_id)
        .order_by(UserSubscription.id.desc())
        .first()
    )
    if subscription is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    return success_response(
        data={
            "id": subscription.id,
            "plan_id": subscription.plan_id,
            "status": subscription.status,
            "current_period_start": subscription.current_period_start,
            "current_period_end": subscription.current_period_end,
            "cancel_at_period_end": subscription.cancel_at_period_end,
        }
    )


@router.post("/cancel", summary="구독 해지", description="현재 구독을 해지 상태로 전환합니다.")
async def cancel_subscription(
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """구독 해지 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.
    - body의 `subscription_id`는 선택이며, 없으면 최신 구독을 대상으로 합니다.

    처리:
    - cancel_at_period_end=true로 설정하고 상태를 cancelled로 변경합니다.
    """
    subscription_id = payload.get("subscription_id")
    query = db.query(UserSubscription).filter(UserSubscription.user_id == current_user_id)
    if subscription_id:
        query = query.filter(UserSubscription.id == subscription_id)

    subscription = query.order_by(UserSubscription.id.desc()).first()
    if subscription is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    subscription.cancel_at_period_end = True
    subscription.status = "cancelled"
    db.commit()
    return success_response(data={"id": subscription.id, "status": subscription.status, "cancel_at_period_end": True})
