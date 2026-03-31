from fastapi import APIRouter

router = APIRouter()


@router.get("/projects")
async def search_projects() -> dict:
    return {"message": "TODO: search projects"}


@router.get("/ideas")
async def search_ideas() -> dict:
    return {"message": "TODO: search ideas"}


@router.get("/users")
async def search_users() -> dict:
    return {"message": "TODO: search users"}
