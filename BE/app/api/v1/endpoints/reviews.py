from fastapi import APIRouter

router = APIRouter()


@router.get("/projects/{project_id}")
async def list_project_reviews(project_id: int) -> dict:
    return {"message": f"TODO: list reviews for project {project_id}"}


@router.get("/users/{user_id}")
async def list_user_reviews(user_id: int) -> dict:
    return {"message": f"TODO: list reviews for user {user_id}"}
