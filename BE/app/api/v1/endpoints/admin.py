from fastapi import APIRouter

router = APIRouter()


@router.get("/users")
async def list_users_for_admin() -> dict:
    return {"message": "TODO: admin list users"}


@router.patch("/users/{user_id}/status")
async def update_user_status(user_id: int) -> dict:
    return {"message": f"TODO: admin update user status {user_id}"}


@router.get("/projects")
async def list_projects_for_admin() -> dict:
    return {"message": "TODO: admin list projects"}
