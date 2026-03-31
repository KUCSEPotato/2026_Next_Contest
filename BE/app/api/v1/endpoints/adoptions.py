from fastapi import APIRouter

router = APIRouter()


@router.post("/projects/{project_id}/request")
async def create_adoption_request(project_id: int) -> dict:
    return {"message": f"TODO: adoption request for project {project_id}"}


@router.patch("/requests/{request_id}")
async def decide_adoption_request(request_id: int) -> dict:
    return {"message": f"TODO: decide adoption request {request_id}"}
