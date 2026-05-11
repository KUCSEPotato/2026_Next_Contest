import asyncio
import json
import re
from typing import Any

from fastapi import APIRouter, HTTPException, status
from google import genai

from app.api.v1.response import success_response
from app.core.config import settings
from app.schemas.llm import LlmTodoRequest
from app.schemas.llm import LlmMemoirRefineRequest
from app.schemas.llm import LlmMemoirRefineResponse

router = APIRouter()


@router.post(
    "/llm/todo",
    summary="LLM 기반 사용자별 To-Do 목록 생성",
    description="대화 내역을 분석하여 사용자별 To-Do 리스트를 JSON 형태로 반환합니다.",
)
async def generate_todo_list(payload: LlmTodoRequest) -> dict[str, Any]:
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini API key is not configured",
        )

    conversation_text = payload.conversation_text.strip()
    if not conversation_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="conversation_text is required",
        )

    response_text = await _call_gemini_for_todo_list(conversation_text)
    todos_by_user = _parse_gemini_response(response_text)

    return success_response(data={"todos_by_user": todos_by_user})


async def _call_gemini_for_todo_list(conversation_text: str) -> str:
    return await asyncio.to_thread(_sync_call_gemini_for_todo_list, conversation_text)


def _sync_call_gemini_for_todo_list(conversation_text: str) -> str:
    prompt = _build_prompt(conversation_text)
    client = genai.Client(api_key=settings.gemini_api_key)

    try:
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=prompt,
            config={
                    "temperature": 0.0,
                    "max_output_tokens": 512,
                    "response_mime_type": "application/json",
                },
        )
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini API request failed: {str(error)}",
        )

    text = getattr(response, "text", None) or getattr(response, "content", None)
    if not text:
        candidates = getattr(response, "candidates", None)
        if isinstance(candidates, list) and len(candidates) > 0:
            candidate = candidates[0]
            text = getattr(candidate, "content", None) or getattr(candidate, "output", None) or ""

    return text or ""


def _build_prompt(conversation_text: str) -> str:
    return (
        "당신은 대화에서 할 일을 추출하는 AI입니다.\n"
        "아래 대화와 프로젝트 정보를 분석하여 사용자별 할 일 목록을 JSON 형식으로만 반환하세요.\n\n"

        "반드시 아래 규칙을 지키세요:\n"
        "1. 반드시 유효한 JSON만 출력하세요.\n"
        "2. 최상위 필드는 반드시 \"todos_by_user\" 여야 합니다.\n"
        "3. 각 key는 사용자 이름을 사용하세요.\n"
        "4. 각 value는 해당 사용자의 할 일 문자열 배열이어야 합니다.\n"
        "5. 각 할 일은 반드시 '단계 - 구체적인 작업' 형식으로 작성하세요.\n"
        "6. 추상적인 표현을 피하고, 무엇을 만들고 확인해야 하는지 드러나게 작성하세요.\n"
        "7. 프로젝트 완성까지 이어지는 순서를 고려해 기획, 설계, 구현, 검증 단계를 섞어 10~15개를 제안하세요.\n"
        "8. 설명, 마크다운, 코드블록, 추가 문장은 절대 출력하지 마세요.\n"
        "9. 할 일이 없으면 정확히 {\"todos_by_user\": {}} 를 반환하세요.\n\n"

        "출력 예시:\n"
        "{\n"
        '  "todos_by_user": {\n'
        '    "민수": [\n'
        '      "설계 - 로그인 API 요청/응답 필드 확정",\n'
        '      "검증 - 배포 전 환경 변수와 헬스체크 확인"\n'
        "    ],\n"
        '    "지현": [\n'
        '      "UI 디자인 수정"\n'
        "    ]\n"
        "  }\n"
        "}\n\n"

        "대화:\n"
        f"{conversation_text}\n"
    )


def _parse_gemini_response(response_text: str) -> dict[str, Any]:
    if not response_text:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Gemini response did not return any text.",
        )

    todos_payload = _extract_json_payload(response_text)
    if not isinstance(todos_payload, dict) or "todos_by_user" not in todos_payload:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Gemini response did not return a valid todos_by_user JSON object.",
        )

    if not isinstance(todos_payload["todos_by_user"], dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="todos_by_user must be a JSON object mapping user names to arrays of todos.",
        )

    return todos_payload["todos_by_user"]


def _extract_json_payload(text: str) -> dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{(?:.|\n)*\}", text)
        if not match:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to parse Gemini output as JSON. Raw response: {text[:300]}",
            )
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to parse extracted JSON from Gemini output. Raw response: {text[:300]}",
            )

