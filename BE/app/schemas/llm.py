from pydantic import BaseModel, Field


class LlmTodoRequest(BaseModel):
    conversation_text: str


class LlmMemoirRefineRequest(BaseModel):
    felt_point: str = Field(min_length=1, description="느낀 점 텍스트")
    lacked_point: str = Field(min_length=1, description="부족했던 점 텍스트")


class LlmMemoirRefineResponse(BaseModel):
    refined_felt: str
    refined_lacked: str
