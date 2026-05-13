import os
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.api.v1.endpoints.coins import _get_package
from app.api.v1.response import success_response
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id
from app.models import Payment
from app.models import User
from app.services.economy import award_coins
from app.services.economy import notify_user
from app.services.toss_payment_service import confirm_toss_payment

router = APIRouter()

PAYMENT_STATUS_READY = "READY"
PAYMENT_STATUS_IN_PROGRESS = "IN_PROGRESS"
PAYMENT_STATUS_DONE = "DONE"
PAYMENT_STATUS_FAILED = "FAILED"


class PaymentPrepareRequest(BaseModel):
    product_id: str = Field(min_length=1, max_length=50)


class PaymentConfirmRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    payment_key: str = Field(alias="paymentKey", min_length=1, max_length=200)
    order_id: str = Field(alias="orderId", min_length=6, max_length=100)
    amount: int = Field(gt=0)


class PaymentFailRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    order_id: str = Field(alias="orderId", min_length=6, max_length=100)
    code: str | None = Field(default=None, max_length=100)
    message: str | None = Field(default=None, max_length=500)


def _payment_response(payment: Payment, *, balance: int | None = None) -> dict[str, Any]:
    data: dict[str, Any] = {
        "payment_id": payment.id,
        "order_id": payment.order_id,
        "order_name": payment.order_name,
        "amount": payment.amount,
        "coin_amount": payment.coin_amount,
        "status": payment.status,
    }
    if balance is not None:
        data["coin_balance"] = balance
    return data


def _get_redirect_url(name: str) -> str | None:
    value = os.getenv(name)
    return value.strip() if value else None


def _load_payment_for_user(db: Session, order_id: str, user_id: int) -> Payment:
    payment = (
        db.query(Payment)
        .filter(
            Payment.order_id == order_id,
            Payment.deleted_at.is_(None),
        )
        .first()
    )
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment order not found")
    if payment.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Payment order owner mismatch")
    return payment


@router.post("/prepare", summary="토스 결제 주문 생성", description="서버가 코인 상품 금액과 주문번호를 확정하고 결제 준비 데이터를 반환합니다.")
async def prepare_payment(
    payload: PaymentPrepareRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, current_user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    package = _get_package(payload.product_id)
    coin_amount = int(package["coin_amount"])
    amount = int(package["price_krw"])
    order_name = f"Devory 코인 {coin_amount}개"
    order_id = f"devory_coin_{current_user_id}_{uuid.uuid4().hex}"

    payment = Payment(
        user_id=current_user_id,
        order_id=order_id,
        order_name=order_name,
        amount=amount,
        coin_amount=coin_amount,
        currency="KRW",
        status=PAYMENT_STATUS_READY,
        provider="TOSS",
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    response = _payment_response(payment)
    response["success_url"] = _get_redirect_url("TOSS_SUCCESS_REDIRECT_URL")
    response["fail_url"] = _get_redirect_url("TOSS_FAIL_REDIRECT_URL")
    return success_response(data=response)


@router.post("/confirm", summary="토스 결제 승인", description="토스 결제 성공 리다이렉트 이후 서버에서 금액을 검증하고 결제를 승인합니다.")
async def confirm_payment(
    payload: PaymentConfirmRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    payment = _load_payment_for_user(db, payload.order_id, current_user_id)
    user = db.get(User, current_user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if payment.status == PAYMENT_STATUS_DONE:
        return success_response(data=_payment_response(payment, balance=user.coin_balance))

    if payment.payment_key and payment.payment_key != payload.payment_key:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payment key does not match existing order")

    if payment.amount != payload.amount:
        payment.status = PAYMENT_STATUS_FAILED
        payment.failed_at = datetime.now(timezone.utc)
        payment.failure_code = "AMOUNT_MISMATCH"
        payment.failure_message = "Requested amount does not match server order amount"
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment amount mismatch")

    payment.status = PAYMENT_STATUS_IN_PROGRESS
    payment.payment_key = payload.payment_key
    db.commit()

    try:
        toss_data = await confirm_toss_payment(payload.payment_key, payment.order_id, payment.amount)
    except HTTPException as exc:
        payment.status = PAYMENT_STATUS_FAILED
        payment.failed_at = datetime.now(timezone.utc)
        detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
        toss_error = detail.get("toss_error") if isinstance(detail, dict) else None
        if isinstance(toss_error, dict):
            payment.failure_code = str(toss_error.get("code") or "")[:100] or None
            payment.failure_message = str(toss_error.get("message") or detail.get("message") or "")[:500] or None
            payment.toss_raw_response = toss_error
        else:
            payment.failure_message = str(detail.get("message") or exc.detail)[:500]
        db.commit()
        raise

    confirmed_order_id = toss_data.get("orderId")
    confirmed_amount = toss_data.get("totalAmount") or toss_data.get("amount")
    confirmed_status = toss_data.get("status")
    if confirmed_order_id != payment.order_id or int(confirmed_amount or 0) != payment.amount or confirmed_status != "DONE":
        payment.status = PAYMENT_STATUS_FAILED
        payment.failed_at = datetime.now(timezone.utc)
        payment.failure_code = "TOSS_RESPONSE_MISMATCH"
        payment.failure_message = "Toss confirm response did not match the prepared order"
        payment.toss_raw_response = toss_data
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Toss payment response mismatch")

    payment.status = PAYMENT_STATUS_DONE
    payment.method = toss_data.get("method")
    payment.approved_at = datetime.now(timezone.utc)
    payment.toss_raw_response = toss_data
    balance = award_coins(
        db,
        user_id=payment.user_id,
        amount=int(payment.coin_amount or 0),
        event_type="coin.purchase",
        source_type="payment",
        source_id=payment.id,
        note=payment.order_name,
    )
    notify_user(
        db,
        user_id=payment.user_id,
        notification_type="coin.payment_done",
        title="코인 충전이 완료되었습니다.",
        body=f"{payment.coin_amount}코인이 충전되었습니다.",
        data={"payment_id": payment.id, "order_id": payment.order_id, "coin_amount": payment.coin_amount},
    )
    db.commit()
    db.refresh(payment)

    return success_response(data=_payment_response(payment, balance=balance))


@router.post("/fail", summary="토스 결제 실패 기록", description="토스 실패 리다이렉트 정보를 결제 주문에 기록합니다.")
async def record_payment_failure(
    payload: PaymentFailRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    payment = _load_payment_for_user(db, payload.order_id, current_user_id)
    if payment.status == PAYMENT_STATUS_DONE:
        return success_response(data=_payment_response(payment))

    payment.status = PAYMENT_STATUS_FAILED
    payment.failed_at = datetime.now(timezone.utc)
    payment.failure_code = payload.code
    payment.failure_message = payload.message
    db.commit()
    db.refresh(payment)

    return success_response(data=_payment_response(payment))
