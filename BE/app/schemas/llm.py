from pydantic import BaseModel


class LlmTodoRequest(BaseModel):
    conversation_text: str
