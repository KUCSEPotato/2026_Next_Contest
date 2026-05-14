from typing import Literal

from pydantic import BaseModel, Field


DifficultyValue = Literal[
    "beginner",
    "intermediate",
    "advanced",
    "easy",
    "normal",
    "hard",
]


class IdeaCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    difficulty: DifficultyValue
    summary: str | None = None
    domain: str | None = None
    tech_stack: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)
    hashtags: list[str] = Field(default_factory=list)
    required_members: int = Field(default=1, ge=1, le=100)
    expected_period: str | None = None
    preferred_members: str | None = None
    is_open: bool = True


class IdeaUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1)
    difficulty: DifficultyValue | None = None
    summary: str | None = None
    domain: str | None = None
    tech_stack: list[str] | None = None
    hashtags: list[str] | None = None
    required_members: int | None = Field(default=None, ge=1, le=100)
    expected_period: str | None = None
    preferred_members: str | None = None
    is_open: bool | None = None
