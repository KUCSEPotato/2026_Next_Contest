from fastapi import APIRouter

router = APIRouter()


@router.post("")
async def create_project() -> dict:
    return {"message": "TODO: create project"}


@router.get("")
async def list_projects() -> dict:
    return {"message": "TODO: list projects"}


@router.get("/{project_id}")
async def get_project(project_id: int) -> dict:
    return {"message": f"TODO: get project {project_id}"}


@router.post("/{project_id}/applications")
async def apply_project(project_id: int) -> dict:
    return {"message": f"TODO: apply project {project_id}"}


@router.get("/{project_id}/applications")
async def list_applications(project_id: int) -> dict:
    return {"message": f"TODO: list applications {project_id}"}


@router.patch("/{project_id}/applications/{application_id}")
async def decide_application(project_id: int, application_id: int) -> dict:
    return {
        "message": f"TODO: decide application {application_id} for project {project_id}"
    }


@router.patch("/{project_id}")
async def update_project(project_id: int) -> dict:
    return {"message": f"TODO: update project {project_id}"}


@router.delete("/{project_id}")
async def delete_project(project_id: int) -> dict:
    return {"message": f"TODO: delete project {project_id}"}


@router.patch("/{project_id}/status")
async def update_project_status(project_id: int) -> dict:
    return {"message": f"TODO: update status for project {project_id}"}


@router.post("/{project_id}/milestones")
async def create_milestone(project_id: int) -> dict:
    return {"message": f"TODO: create milestone for project {project_id}"}


@router.get("/{project_id}/progress")
async def get_project_progress(project_id: int) -> dict:
    return {"message": f"TODO: get progress for project {project_id}"}


@router.post("/{project_id}/recruitments")
async def create_recruitment(project_id: int) -> dict:
    return {"message": f"TODO: create recruitment for project {project_id}"}


@router.post("/{project_id}/invite")
async def invite_user(project_id: int) -> dict:
    return {"message": f"TODO: invite user to project {project_id}"}


@router.post("/{project_id}/failure-stories")
async def create_failure_story(project_id: int) -> dict:
    return {"message": f"TODO: create failure story for project {project_id}"}


@router.get("/{project_id}/failure-stories")
async def list_failure_stories(project_id: int) -> dict:
    return {"message": f"TODO: list failure stories for project {project_id}"}


@router.post("/{project_id}/invite/{invite_id}/accept")
async def accept_invite(project_id: int, invite_id: int) -> dict:
    return {"message": f"TODO: accept invite {invite_id} for project {project_id}"}


@router.post("/{project_id}/invite/{invite_id}/reject")
async def reject_invite(project_id: int, invite_id: int) -> dict:
    return {"message": f"TODO: reject invite {invite_id} for project {project_id}"}


@router.post("/{project_id}/members")
async def add_member(project_id: int) -> dict:
    return {"message": f"TODO: add member to project {project_id}"}


@router.delete("/{project_id}/members/{member_id}")
async def remove_member(project_id: int, member_id: int) -> dict:
    return {
        "message": f"TODO: remove member {member_id} from project {project_id}"
    }


@router.patch("/{project_id}/recruitments/{recruitment_id}")
async def update_recruitment(project_id: int, recruitment_id: int) -> dict:
    return {
        "message": f"TODO: update recruitment {recruitment_id} for project {project_id}"
    }


@router.patch("/{project_id}/todos/{todo_id}")
async def update_todo(project_id: int, todo_id: int) -> dict:
    return {"message": f"TODO: update todo {todo_id} for project {project_id}"}


@router.delete("/{project_id}/todos/{todo_id}")
async def delete_todo(project_id: int, todo_id: int) -> dict:
    return {"message": f"TODO: delete todo {todo_id} for project {project_id}"}


@router.get("/{project_id}/retrospectives")
async def list_retrospectives(project_id: int) -> dict:
    return {"message": f"TODO: list retrospectives for project {project_id}"}


@router.get("/{project_id}/retrospectives/{retrospective_id}")
async def get_retrospective(project_id: int, retrospective_id: int) -> dict:
    return {
        "message": f"TODO: get retrospective {retrospective_id} for project {project_id}"
    }


@router.patch("/{project_id}/retrospectives/{retrospective_id}")
async def update_retrospective(project_id: int, retrospective_id: int) -> dict:
    return {
        "message": f"TODO: update retrospective {retrospective_id} for project {project_id}"
    }


@router.get("/{project_id}/reviews")
async def list_project_reviews(project_id: int) -> dict:
    return {"message": f"TODO: list reviews for project {project_id}"}


@router.get("/failure-stories")
async def list_all_failure_stories() -> dict:
    return {"message": "TODO: list all failure stories"}


@router.post("/{project_id}/todos")
async def create_todo(project_id: int) -> dict:
    return {"message": f"TODO: create todo for project {project_id}"}


@router.get("/{project_id}/todos")
async def list_todos(project_id: int) -> dict:
    return {"message": f"TODO: list todos for project {project_id}"}


@router.post("/{project_id}/retrospectives")
async def create_retrospective(project_id: int) -> dict:
    return {"message": f"TODO: create retrospective for project {project_id}"}


@router.post("/{project_id}/reviews")
async def create_review(project_id: int) -> dict:
    return {"message": f"TODO: create review for project {project_id}"}
