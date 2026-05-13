import base64
import os
from typing import Any

import httpx
from fastapi import HTTPException, status


def _get_toss_api_base_url() -> str:
    return os.getenv("TOSS_API_BASE_URL", "https://api.tosspayments.com").rstrip("/")


def _get_toss_auth_header() -> str:
    secret_key = os.getenv("TOSS_SECRET_KEY")
    if not secret_key:
        raise RuntimeError("TOSS_SECRET_KEY is not configured")

    encoded = base64.b64encode(f"{secret_key}:".encode("utf-8")).decode("utf-8")
    return f"Basic {encoded}"


async def confirm_toss_payment(payment_key: str, order_id: str, amount: int) -> dict[str, Any]:
    headers = {
        "Authorization": _get_toss_auth_header(),
        "Content-Type": "application/json",
        "Idempotency-Key": order_id,
    }
    payload = {
        "paymentKey": payment_key,
        "orderId": order_id,
        "amount": amount,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{_get_toss_api_base_url()}/v1/payments/confirm",
                json=payload,
                headers=headers,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"message": "Toss payment confirm request failed", "error": str(exc)},
        ) from exc

    try:
        data = response.json()
    except ValueError:
        data = {"message": response.text}

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Toss payment confirm failed", "toss_error": data},
        )

    return data
