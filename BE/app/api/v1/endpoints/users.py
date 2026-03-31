from fastapi import APIRouter

router = APIRouter()


@router.get("/me/profile")
async def get_my_profile() -> dict:
    return {"message": "TODO: get my profile"}


@router.patch("/me/profile")
async def update_my_profile() -> dict:
    return {"message": "TODO: update my profile"}


@router.get("/{user_id}/profile")
async def get_user_profile(user_id: int) -> dict:
    return {"message": f"TODO: get user profile {user_id}"}


@router.get("/{user_id}/stats")
async def get_user_stats(user_id: int) -> dict:
    return {"message": f"TODO: get user stats {user_id}"}


@router.get("/{user_id}/projects")
async def get_user_projects(user_id: int) -> dict:
    return {"message": f"TODO: get user projects {user_id}"}


@router.post("/me/skills")
async def add_my_skill() -> dict:
    return {"message": "TODO: add my skill"}


@router.delete("/me/skills/{skill_id}")
async def remove_my_skill(skill_id: int) -> dict:
    return {"message": f"TODO: remove my skill {skill_id}"}


@router.get("/me/reputation")
async def get_my_reputation() -> dict:
    return {"message": "TODO: get my reputation"}
