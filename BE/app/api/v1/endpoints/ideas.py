from fastapi import APIRouter

router = APIRouter()


@router.post("")
async def create_idea() -> dict:
    return {"message": "TODO: create idea"}


@router.get("")
async def list_ideas() -> dict:
    return {"message": "TODO: list ideas"}


@router.get("/{idea_id}")
async def get_idea(idea_id: int) -> dict:
    return {"message": f"TODO: get idea {idea_id}"}


@router.patch("/{idea_id}")
async def update_idea(idea_id: int) -> dict:
    return {"message": f"TODO: update idea {idea_id}"}


@router.delete("/{idea_id}")
async def delete_idea(idea_id: int) -> dict:
    return {"message": f"TODO: delete idea {idea_id}"}
