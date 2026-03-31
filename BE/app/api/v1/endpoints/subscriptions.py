from fastapi import APIRouter

router = APIRouter()


@router.get("/plans")
async def list_subscription_plans() -> dict:
    return {"message": "TODO: list subscription plans"}


@router.post("/checkout")
async def create_checkout() -> dict:
    return {"message": "TODO: create checkout"}


@router.post("/webhook")
async def payment_webhook() -> dict:
    return {"message": "TODO: payment webhook"}


@router.get("/me")
async def get_my_subscription() -> dict:
    return {"message": "TODO: get my subscription"}
