from datetime import date

from pydantic import BaseModel, Field


class ProjectCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    difficulty: str
    summary: str | None = None
    category: str | None = None
    idea_id: int | None = None
    status: str = "planning"
    progress_percent: float = Field(default=0, ge=0, le=100)
    is_public: bool = True


class ProjectUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1)
    difficulty: str | None = None
    summary: str | None = None
    category: str | None = None
    status: str | None = None
    progress_percent: float | None = Field(default=None, ge=0, le=100)
    is_public: bool | None = None


class ProjectStatusUpdateRequest(BaseModel):
    status: str


class ApplicationCreateRequest(BaseModel):
    message: str | None = None


class ApplicationDecisionRequest(BaseModel):
    status: str
    role_in_project: str | None = None


class MilestoneCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    description: str | None = None
    due_date: date | None = None
    is_done: bool = False


class MilestoneUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    due_date: date | None = None
    is_done: bool | None = None


class TodoCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    assignee_id: int | None = None
    description: str | None = None
    status: str = "todo"
    priority: int = Field(default=3, ge=1, le=5)
    due_date: date | None = None


class TodoUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    assignee_id: int | None = None
    description: str | None = None
    status: str | None = None
    priority: int | None = Field(default=None, ge=1, le=5)
    due_date: date | None = None
