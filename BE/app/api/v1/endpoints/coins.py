from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id
from app.models import CoinPurchaseRequest
from app.models import CoinTransaction
from app.models import User

router = APIRouter()


COIN_PACKAGES = [
    {"id": "drop", "coin_amount": 1, "price_krw": 300, "label": "한 방울"},
    {"id": "cup", "coin_amount": 10, "price_krw": 2000, "label": "한 잔"},
]


class CoinPurchaseRequestCreate(BaseModel):
    package_id: str = Field(min_length=1, max_length=50)
    note: str | None = Field(default=None, max_length=500)


def _get_package(package_id: str) -> dict:
    for package in COIN_PACKAGES:
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
    return success_response(data=COIN_PACKAGES)


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


@router.post("/purchase-requests", summary="물방울 구매 요청 생성", description="PG 연동 전 수동 확인용 물방울 구매 요청을 생성합니다.")
async def create_coin_purchase_request(
    payload: CoinPurchaseRequestCreate,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, current_user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    package = _get_package(payload.package_id)
    note = payload.note.strip() if payload.note else None
    request = CoinPurchaseRequest(
        user_id=current_user_id,
        coin_amount=int(package["coin_amount"]),
        price_krw=int(package["price_krw"]),
        status="pending",
        note=note,
    )
    db.add(request)
    db.commit()
    db.refresh(request)

    return success_response(
        data={
            "id": request.id,
            "coin_amount": request.coin_amount,
            "price_krw": request.price_krw,
            "status": request.status,
            "note": request.note,
            "created_at": request.created_at,
        }
    )


@router.get("/purchase-requests/me", summary="내 물방울 구매 요청 목록", description="내가 만든 수동 물방울 구매 요청을 최신순으로 조회합니다.")
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
            {
                "id": request.id,
                "coin_amount": request.coin_amount,
                "price_krw": request.price_krw,
                "status": request.status,
                "note": request.note,
                "admin_note": request.admin_note,
                "handled_at": request.handled_at,
                "created_at": request.created_at,
            }
            for request in requests
        ]
    )
