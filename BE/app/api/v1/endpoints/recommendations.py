from fastapi import APIRouter

router = APIRouter()


@router.post("/projects")
async def recommend_projects_llm() -> dict:
    return {"message": "TODO: llm project recommendation"}


@router.post("/teammates")
async def recommend_teammates_llm() -> dict:
    return {"message": "TODO: llm teammate recommendation"}


@router.post("/explain")
async def explain_recommendation() -> dict:
    return {"message": "TODO: explain recommendation"}
