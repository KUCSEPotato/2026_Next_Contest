from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id
from app.models import CoinPurchaseRequest
from app.models import CoinTransaction
from app.models import User
from app.services.entitlement_service import get_payment_product_or_404

router = APIRouter()


COIN_PACKAGES = [
    {"id": "drop", "coin_amount": 1, "price_krw": 300, "label": "한 방울"},
    {"id": "cup", "coin_amount": 10, "price_krw": 2000, "label": "한 잔"},
]


ADDITIONAL_COIN_PACKAGES = [
    {"id": "bottle", "coin_amount": 100, "price_krw": 15000, "label": "한 병"},
]


def _coin_packages() -> list[dict]:
    return [*COIN_PACKAGES, *ADDITIONAL_COIN_PACKAGES]


class CoinPurchaseRequestCreate(BaseModel):
    package_id: str | None = Field(default=None, min_length=1, max_length=50)
    product_code: str | None = Field(default=None, min_length=1, max_length=50)
    note: str | None = Field(default=None, max_length=500)


def _get_package(package_id: str) -> dict:
    for package in _coin_packages():
        if package["id"] == package_id:
            return package
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid coin package")


@router.get("/me", summary="내 물방울 잔액 조회", description="현재 로그인한 사용자의 물방울 잔액을 조회합니다.")
async def get_my_coin_balance(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, current_user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return success_response(data={"coin_balance": user.coin_balance, "waterdrop_balance": user.coin_balance})


@router.get("/packages", summary="물방울 패키지 목록", description="수동 결제 요청에 사용할 물방울 패키지를 조회합니다.")
async def list_coin_packages() -> dict:
    return success_response(data=_coin_packages())


@router.get(
    "/transactions/me",
    summary="내 물방울 거래 내역 조회",
    description="현재 로그인한 사용자의 물방울 충전/지급 및 사용 기록을 최신순으로 조회합니다.",
)
async def list_my_coin_transactions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    direction: str | None = Query(default=None, pattern="^(earned|spent)$"),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, current_user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    query = db.query(CoinTransaction).filter(CoinTransaction.user_id == current_user_id)
    if direction == "earned":
        query = query.filter(CoinTransaction.amount > 0)
    elif direction == "spent":
        query = query.filter(CoinTransaction.amount < 0)

    total = query.count()
    transactions = (
        query.order_by(CoinTransaction.created_at.desc(), CoinTransaction.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return success_response(
        data={
            "transactions": [
                {
                    "id": transaction.id,
                    "amount": transaction.amount,
                    "direction": "earned" if transaction.amount > 0 else "spent",
                    "balance_after": transaction.balance_after,
                    "event_type": transaction.event_type,
                    "source_type": transaction.source_type,
                    "source_id": transaction.source_id,
                    "note": transaction.note,
                    "created_at": transaction.created_at,
                }
                for transaction in transactions
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }
    )


def _serialize_purchase_request(request: CoinPurchaseRequest) -> dict:
    return {
        "id": request.id,
        "request_type": request.request_type,
        "coin_amount": request.coin_amount,
        "price_krw": request.price_krw,
        "product_code": request.product_code,
        "product_name": request.product_name,
        "product_type": request.product_type,
        "entitlement_days": request.entitlement_days,
        "status": request.status,
        "note": request.note,
        "admin_note": request.admin_note,
        "handled_at": request.handled_at,
        "created_at": request.created_at,
    }


@router.post("/purchase-requests", summary="수동 구매 요청 생성", description="PG 외 수동 확인용 물방울/이용권 구매 요청을 생성합니다.")
async def create_coin_purchase_request(
    payload: CoinPurchaseRequestCreate,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, current_user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    note = payload.note.strip() if payload.note else None
    if payload.product_code:
        product = get_payment_product_or_404(db, payload.product_code)
        request = CoinPurchaseRequest(
            user_id=current_user_id,
            request_type="ENTITLEMENT",
            coin_amount=0,
            price_krw=int(product.price_krw),
            product_code=product.product_code,
            product_name=product.name,
            product_type=product.product_type,
            entitlement_days=product.duration_days,
            status="pending",
            note=note,
        )
    else:
        if not payload.package_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="package_id or product_code is required")
        package = _get_package(payload.package_id)
        request = CoinPurchaseRequest(
            user_id=current_user_id,
            request_type="COIN",
            coin_amount=int(package["coin_amount"]),
            price_krw=int(package["price_krw"]),
            status="pending",
            note=note,
        )
    db.add(request)
    db.commit()
    db.refresh(request)

    return success_response(data=_serialize_purchase_request(request))


@router.get("/purchase-requests/me", summary="내 수동 구매 요청 목록", description="내가 만든 수동 물방울/이용권 구매 요청을 최신순으로 조회합니다.")
async def list_my_coin_purchase_requests(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    requests = (
        db.query(CoinPurchaseRequest)
        .filter(CoinPurchaseRequest.user_id == current_user_id)
        .order_by(CoinPurchaseRequest.id.desc())
        .all()
    )

    return success_response(
        data=[
            _serialize_purchase_request(request) for request in requests
        ]
    )
