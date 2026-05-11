from pydantic import BaseModel, Field


class UserProfileUpdateRequest(BaseModel):
    nickname: str | None = Field(default=None, min_length=2, max_length=50)
    name: str | None = Field(default=None, min_length=1, max_length=100)
    phone_number: str | None = Field(default=None, min_length=5, max_length=20)
    bio: str | None = None
    avatar_url: str | None = None


class OnboardingIdeaSelectionRequest(BaseModel):
    idea_ids: list[int] = Field(min_length=1)