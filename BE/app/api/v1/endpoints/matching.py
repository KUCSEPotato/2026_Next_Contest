from fastapi import APIRouter

router = APIRouter()


@router.get("/recommend-candidates")
async def recommend_candidates() -> dict:
    return {"message": "TODO: recommend candidates"}


@router.get("/recommend-projects")
async def recommend_projects() -> dict:
    return {"message": "TODO: recommend projects"}
