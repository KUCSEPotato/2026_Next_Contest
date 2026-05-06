from datetime import date

from pydantic import BaseModel, Field


# ============================================
# 공통 기본 요청 클래스
# ============================================
class CommonProjectRequest(BaseModel):
    """프로젝트와 재모집이 공통으로 사용하는 필드."""
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    difficulty: str
    summary: str | None = None
    category: str | None = None


class CommonProjectUpdateRequest(BaseModel):
    """프로젝트와 재모집 업데이트 시 공통으로 사용하는 필드."""
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1)
    difficulty: str | None = None
    summary: str | None = None
    category: str | None = None


# ============================================
# 프로젝트 요청 클래스
# ============================================
class ProjectCreateRequest(CommonProjectRequest):
    idea_id: int | None = None
    status: str = "planning"
    progress_percent: float = Field(default=0, ge=0, le=100)
    max_members: int = Field(default=10, ge=1, le=100)
    is_public: bool = True


class ProjectUpdateRequest(CommonProjectUpdateRequest):
    status: str | None = None
    progress_percent: float | None = Field(default=None, ge=0, le=100)
    max_members: int | None = Field(default=None, ge=1, le=100)
    is_public: bool | None = None


class ProjectStatusUpdateRequest(BaseModel):
    status: str


# ============================================
# 지원 및 초대 요청 클래스
# ============================================
class ApplicationCreateRequest(BaseModel):
    message: str | None = None


class ApplicationDecisionRequest(BaseModel):
    status: str
    role_in_project: str | None = None


# ============================================
# 마일스톤 요청 클래스
# ============================================
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


# ============================================
# Todo 요청 클래스
# ============================================
class TodoCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    assignee_id: int | None = None
    assignee_ids: list[int] | None = None
    description: str | None = None
    stage: str = "planning"
    status: str = "todo"
    priority: int = Field(default=3, ge=1, le=5)
    due_date: date | None = None


class TodoUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    assignee_id: int | None = None
    assignee_ids: list[int] | None = None
    description: str | None = None
    stage: str | None = None
    status: str | None = None
    priority: int | None = Field(default=None, ge=1, le=5)
    due_date: date | None = None


# ============================================
# 재모집 요청 클래스 (공통 필드 상속)
# ============================================
class RecruitmentCreateRequest(CommonProjectRequest):
    position_name: str = Field(min_length=1, max_length=100)
    required_count: int = Field(default=1, ge=1, le=20)
    deadline: date | None = None
    status: str = "open"


class RecruitmentUpdateRequest(CommonProjectUpdateRequest):
    position_name: str | None = Field(default=None, min_length=1, max_length=100)
    required_count: int | None = Field(default=None, ge=1, le=20)
    deadline: date | None = None
    status: str | None = None
