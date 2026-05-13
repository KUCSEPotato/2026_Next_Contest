from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Payment
from app.models import PaymentProduct
from app.models import UserEntitlement
from app.models import UserUsageLog


USAGE_IDEA_VIEW = "IDEA_VIEW"
USAGE_PROJECT_CREATE = "PROJECT_CREATE"
USAGE_PROJECT_APPLY = "PROJECT_APPLY"
USAGE_PROJECT_DISCARD = "PROJECT_DISCARD"
USAGE_COMMUNITY_WRITE = "COMMUNITY_WRITE"
USAGE_PROJECT_BOOST = "PROJECT_BOOST"

PLAN_PRIORITY = {
    "PRO_MONTHLY": 60,
    "PLUS_MONTHLY": 50,
    "PASS_7D": 40,
    "PASS_3D": 30,
    "PASS_1D": 20,
    "FREE": 0,
}


@dataclass(frozen=True)
class EffectivePlan:
    product_code: str
    product_type: str
    name: str
    entitlement: UserEntitlement | None
    product: PaymentProduct | None
    expires_at: datetime | None = None


FREE_LIMITS = {
    USAGE_IDEA_VIEW: {"allowed": False, "message": "아이디어 무료 열람 권한이 없습니다."},
    USAGE_PROJECT_CREATE: {"allowed": False, "message": "프로젝트 생성은 유료 플랜 또는 기간권이 필요합니다."},
    USAGE_PROJECT_DISCARD: {"allowed": False, "message": "프로젝트 버리기는 유료 플랜 또는 기간권이 필요합니다."},
    USAGE_PROJECT_APPLY: {"daily": 1},
    USAGE_COMMUNITY_WRITE: {"daily": 1},
    USAGE_PROJECT_BOOST: {"allowed": False, "message": "프로젝트 상단 노출은 PRO 플랜에서만 사용할 수 있습니다."},
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def seed_payment_products(db: Session) -> None:
    products = [
        {
            "product_code": "PLUS_MONTHLY",
            "product_type": "SUBSCRIPTION",
            "name": "Devory Plus 월 구독",
            "price_krw": 7900,
            "duration_days": 30,
            "billing_interval_days": 30,
            "auto_renew_available": True,
            "idea_view_daily_limit": 3,
            "project_create_daily_limit": 1,
            "project_discard_unlimited": True,
            "project_apply_unlimited": True,
            "project_apply_priority": True,
            "community_write_unlimited": True,
            "project_boost_total_limit": 0,
        },
        {
            "product_code": "PRO_MONTHLY",
            "product_type": "SUBSCRIPTION",
            "name": "Devory Pro 월 구독",
            "price_krw": 12900,
            "duration_days": 30,
            "billing_interval_days": 30,
            "auto_renew_available": True,
            "project_create_daily_limit": 3,
            "project_discard_unlimited": True,
            "project_apply_unlimited": True,
            "project_apply_priority": True,
            "community_write_unlimited": True,
            "project_boost_total_limit": 4,
        },
        {
            "product_code": "PASS_1D",
            "product_type": "PASS",
            "name": "Devory 1일권",
            "price_krw": 1900,
            "duration_days": 1,
            "billing_interval_days": None,
            "auto_renew_available": False,
            "project_create_total_limit": 1,
            "project_discard_unlimited": True,
            "project_apply_total_limit": 3,
            "community_write_unlimited": True,
            "project_boost_total_limit": 0,
        },
        {
            "product_code": "PASS_3D",
            "product_type": "PASS",
            "name": "Devory 3일권",
            "price_krw": 2900,
            "duration_days": 3,
            "billing_interval_days": None,
            "auto_renew_available": False,
            "project_create_daily_limit": 1,
            "project_create_total_limit": 2,
            "project_discard_unlimited": True,
            "project_apply_daily_limit": 3,
            "project_apply_total_limit": 5,
            "community_write_unlimited": True,
            "project_boost_total_limit": 0,
        },
        {
            "product_code": "PASS_7D",
            "product_type": "PASS",
            "name": "Devory 7일권",
            "price_krw": 4900,
            "duration_days": 7,
            "billing_interval_days": None,
            "auto_renew_available": False,
            "project_create_daily_limit": 1,
            "project_create_total_limit": 3,
            "project_discard_unlimited": True,
            "project_apply_daily_limit": 3,
            "project_apply_total_limit": 10,
            "community_write_unlimited": True,
            "project_boost_total_limit": 0,
        },
    ]

    for data in products:
        product = db.query(PaymentProduct).filter(PaymentProduct.product_code == data["product_code"]).first()
        if product is None:
            product = PaymentProduct(**data)
            db.add(product)
            continue
        for key, value in data.items():
            setattr(product, key, value)
        product.is_active = True


def get_payment_product_or_404(db: Session, product_code: str) -> PaymentProduct:
    seed_payment_products(db)
    product = (
        db.query(PaymentProduct)
        .filter(PaymentProduct.product_code == product_code, PaymentProduct.is_active.is_(True))
        .first()
    )
    if product is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payment product")
    return product


def list_payment_products(db: Session) -> list[PaymentProduct]:
    seed_payment_products(db)
    return (
        db.query(PaymentProduct)
        .filter(PaymentProduct.is_active.is_(True))
        .order_by(PaymentProduct.product_type.asc(), PaymentProduct.price_krw.asc())
        .all()
    )


def expire_old_entitlements(db: Session, user_id: int) -> None:
    db.query(UserEntitlement).filter(
        UserEntitlement.user_id == user_id,
        UserEntitlement.status == "ACTIVE",
        UserEntitlement.expires_at <= _now(),
    ).update({"status": "EXPIRED"}, synchronize_session=False)


def get_active_entitlement(db: Session, user_id: int) -> tuple[UserEntitlement | None, PaymentProduct | None]:
    expire_old_entitlements(db, user_id)
    rows = (
        db.query(UserEntitlement, PaymentProduct)
        .join(PaymentProduct, PaymentProduct.id == UserEntitlement.product_id)
        .filter(
            UserEntitlement.user_id == user_id,
            UserEntitlement.status == "ACTIVE",
            UserEntitlement.expires_at > _now(),
        )
        .all()
    )
    if not rows:
        return None, None

    entitlement, product = max(rows, key=lambda row: PLAN_PRIORITY.get(row[0].product_code, 0))
    return entitlement, product


def get_effective_plan(db: Session, user_id: int) -> EffectivePlan:
    entitlement, product = get_active_entitlement(db, user_id)
    if entitlement is None or product is None:
        return EffectivePlan(product_code="FREE", product_type="FREE", name="무료", entitlement=None, product=None)
    return EffectivePlan(
        product_code=entitlement.product_code,
        product_type=entitlement.product_type,
        name=product.name,
        entitlement=entitlement,
        product=product,
        expires_at=entitlement.expires_at,
    )


def create_entitlement_for_payment(db: Session, payment: Payment, product: PaymentProduct) -> UserEntitlement:
    existing = db.query(UserEntitlement).filter(UserEntitlement.payment_id == payment.id).first()
    if existing is not None:
        return existing

    return grant_entitlement(db, user_id=payment.user_id, product=product, payment=payment)


def grant_entitlement(
    db: Session,
    user_id: int,
    product: PaymentProduct,
    payment: Payment | None = None,
) -> UserEntitlement:
    starts_at = _now()
    expires_at = starts_at + timedelta(days=int(product.duration_days or 30))
    is_subscription = product.product_type == "SUBSCRIPTION"
    entitlement = UserEntitlement(
        user_id=user_id,
        product_id=product.id,
        payment_id=payment.id if payment else None,
        product_code=product.product_code,
        product_type=product.product_type,
        starts_at=starts_at,
        expires_at=expires_at,
        next_renewal_at=expires_at if is_subscription else None,
        auto_renew_enabled=False,
        renewal_status="PENDING_BILLING_SETUP" if is_subscription else "NONE",
        status="ACTIVE",
    )
    db.add(entitlement)
    db.flush()
    if payment is not None:
        payment.entitlement_id = entitlement.id
    return entitlement


def _today_count(
    db: Session,
    user_id: int,
    usage_type: str,
    entitlement_id: int | None,
) -> int:
    query = db.query(func.count(UserUsageLog.id)).filter(
        UserUsageLog.user_id == user_id,
        UserUsageLog.usage_type == usage_type,
        UserUsageLog.usage_date == date.today(),
    )
    if entitlement_id is None:
        query = query.filter(UserUsageLog.entitlement_id.is_(None))
    else:
        query = query.filter(UserUsageLog.entitlement_id == entitlement_id)
    return int(query.scalar() or 0)


def _total_count(db: Session, user_id: int, usage_type: str, entitlement_id: int | None) -> int:
    query = db.query(func.count(UserUsageLog.id)).filter(
        UserUsageLog.user_id == user_id,
        UserUsageLog.usage_type == usage_type,
    )
    if entitlement_id is None:
        query = query.filter(UserUsageLog.entitlement_id.is_(None))
    else:
        query = query.filter(UserUsageLog.entitlement_id == entitlement_id)
    return int(query.scalar() or 0)


def _limit_for_product(product: PaymentProduct, usage_type: str) -> dict[str, Any]:
    if usage_type == USAGE_IDEA_VIEW:
        if product.product_code == "PRO_MONTHLY":
            return {"unlimited": True}
        return {"daily": product.idea_view_daily_limit, "total": product.idea_view_total_limit}
    if usage_type == USAGE_PROJECT_CREATE:
        return {"daily": product.project_create_daily_limit, "total": product.project_create_total_limit}
    if usage_type == USAGE_PROJECT_APPLY:
        return {
            "unlimited": product.project_apply_unlimited,
            "daily": product.project_apply_daily_limit,
            "total": product.project_apply_total_limit,
        }
    if usage_type == USAGE_PROJECT_DISCARD:
        return {"unlimited": product.project_discard_unlimited}
    if usage_type == USAGE_COMMUNITY_WRITE:
        return {"unlimited": product.community_write_unlimited, "daily": product.community_write_daily_limit}
    if usage_type == USAGE_PROJECT_BOOST:
        return {"total": product.project_boost_total_limit}
    return {"allowed": False, "message": "지원하지 않는 사용 권한입니다."}


def check_usage_allowed(db: Session, user_id: int, usage_type: str) -> dict[str, Any]:
    plan = get_effective_plan(db, user_id)
    entitlement_id = plan.entitlement.id if plan.entitlement else None
    limits = FREE_LIMITS.get(usage_type, {"allowed": False}) if plan.product is None else _limit_for_product(plan.product, usage_type)

    if limits.get("allowed") is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=limits.get("message") or "해당 기능을 사용할 권한이 없습니다.",
        )

    if limits.get("unlimited"):
        return {"allowed": True, "plan": plan, "priority": bool(plan.product and plan.product.project_apply_priority)}

    daily_limit = limits.get("daily")
    if daily_limit is not None:
        daily_used = _today_count(db, user_id, usage_type, entitlement_id)
        if daily_used >= int(daily_limit):
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="일일 사용 한도를 초과했습니다.")

    total_limit = limits.get("total")
    if total_limit is not None:
        total_used = _total_count(db, user_id, usage_type, entitlement_id)
        if total_used >= int(total_limit):
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="총 사용 한도를 초과했습니다.")

    if daily_limit is None and total_limit is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="해당 기능을 사용할 권한이 없습니다.")

    return {"allowed": True, "plan": plan, "priority": bool(plan.product and plan.product.project_apply_priority)}


def record_usage(
    db: Session,
    user_id: int,
    usage_type: str,
    target_type: str | None = None,
    target_id: int | None = None,
) -> UserUsageLog:
    result = check_usage_allowed(db, user_id, usage_type)
    plan: EffectivePlan = result["plan"]
    entitlement = plan.entitlement
    log = UserUsageLog(
        user_id=user_id,
        entitlement_id=entitlement.id if entitlement else None,
        usage_type=usage_type,
        target_type=target_type,
        target_id=target_id,
        usage_date=date.today(),
    )
    db.add(log)
    if entitlement is not None:
        if usage_type == USAGE_PROJECT_CREATE:
            entitlement.project_create_used += 1
        elif usage_type == USAGE_PROJECT_APPLY:
            entitlement.project_apply_used += 1
        elif usage_type == USAGE_IDEA_VIEW:
            entitlement.idea_view_used += 1
        elif usage_type == USAGE_PROJECT_BOOST:
            entitlement.project_boost_used += 1
    return log


def serialize_product(product: PaymentProduct) -> dict[str, Any]:
    return {
        "product_code": product.product_code,
        "product_type": product.product_type,
        "name": product.name,
        "price_krw": product.price_krw,
        "duration_days": product.duration_days,
        "billing_interval_days": product.billing_interval_days,
        "auto_renew_available": product.auto_renew_available,
        "benefits": {
            "idea_view_daily_limit": product.idea_view_daily_limit,
            "project_create_daily_limit": product.project_create_daily_limit,
            "project_create_total_limit": product.project_create_total_limit,
            "project_discard_unlimited": product.project_discard_unlimited,
            "project_apply_daily_limit": product.project_apply_daily_limit,
            "project_apply_total_limit": product.project_apply_total_limit,
            "project_apply_unlimited": product.project_apply_unlimited,
            "project_apply_priority": product.project_apply_priority,
            "community_write_daily_limit": product.community_write_daily_limit,
            "community_write_unlimited": product.community_write_unlimited,
            "project_boost_total_limit": product.project_boost_total_limit,
        },
    }


def serialize_effective_plan(db: Session, user_id: int) -> dict[str, Any]:
    plan = get_effective_plan(db, user_id)
    entitlement = plan.entitlement
    product = plan.product
    if product is None:
        return {
            "plan": "FREE",
            "product_type": "FREE",
            "name": "무료",
            "expires_at": None,
            "days_remaining": None,
            "next_renewal_at": None,
            "auto_renew_available": False,
            "auto_renew_enabled": False,
            "renewal_status": "NONE",
            "benefits": {
                "idea_view_unlimited": False,
                "project_create_daily_limit": 0,
                "project_apply_daily_limit": 1,
                "project_apply_unlimited": False,
                "project_apply_priority": False,
                "community_write_daily_limit": 1,
                "community_write_unlimited": False,
                "project_boost_remaining": 0,
            },
        }

    project_boost_limit = int(product.project_boost_total_limit or 0)
    project_boost_used = int(entitlement.project_boost_used if entitlement else 0)
    days_remaining = None
    if entitlement and entitlement.expires_at:
        remaining = entitlement.expires_at - _now()
        days_remaining = max(remaining.days + (1 if remaining.seconds or remaining.microseconds else 0), 0)
    return {
        "plan": product.product_code,
        "product_type": product.product_type,
        "name": product.name,
        "expires_at": entitlement.expires_at if entitlement else None,
        "days_remaining": days_remaining,
        "next_renewal_at": entitlement.next_renewal_at if entitlement else None,
        "auto_renew_available": product.auto_renew_available,
        "auto_renew_enabled": entitlement.auto_renew_enabled if entitlement else False,
        "renewal_status": entitlement.renewal_status if entitlement else "NONE",
        "benefits": {
            "idea_view_unlimited": product.product_code == "PRO_MONTHLY",
            "idea_view_daily_limit": product.idea_view_daily_limit,
            "project_create_daily_limit": product.project_create_daily_limit,
            "project_create_total_limit": product.project_create_total_limit,
            "project_create_used": entitlement.project_create_used if entitlement else 0,
            "project_apply_daily_limit": product.project_apply_daily_limit,
            "project_apply_total_limit": product.project_apply_total_limit,
            "project_apply_used": entitlement.project_apply_used if entitlement else 0,
            "project_apply_unlimited": product.project_apply_unlimited,
            "project_apply_priority": product.project_apply_priority,
            "community_write_daily_limit": product.community_write_daily_limit,
            "community_write_unlimited": product.community_write_unlimited,
            "project_boost_total_limit": project_boost_limit,
            "project_boost_used": project_boost_used,
            "project_boost_remaining": max(project_boost_limit - project_boost_used, 0),
        },
    }
