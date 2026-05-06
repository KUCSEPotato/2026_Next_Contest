from pydantic import BaseModel, Field


class IdeaCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    difficulty: str
    summary: str | None = None
    domain: str | None = None
    tech_stack: list[str] = Field(default_factory=list)
    hashtags: list[str] = Field(default_factory=list)
    required_members: int = Field(default=1, ge=1, le=100)
    is_open: bool = True


class IdeaUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1)
    difficulty: str | None = None
    summary: str | None = None
    domain: str | None = None
    tech_stack: list[str] | None = None
    hashtags: list[str] | None = None
    required_members: int | None = Field(default=None, ge=1, le=100)
    is_open: bool | None = None
