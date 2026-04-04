from typing import Any


def success_response(data: Any = None, meta: dict[str, Any] | None = None) -> dict[str, Any]:
    """Return project-wide success envelope.

    Response format: {"success": true, "data": ..., "meta": ...}
    """
    payload: dict[str, Any] = {"success": True, "data": data}
    if meta is not None:
        payload["meta"] = meta
    return payload


def error_response(code: str, message: str, details: Any = None) -> dict[str, Any]:
    """Return project-wide error envelope.

    Response format: {"success": false, "error": {"code": ..., "message": ..., "details": ...}}
    """
    error_payload: dict[str, Any] = {
        "code": code,
        "message": message,
    }
    if details is not None:
        error_payload["details"] = details
    return {"success": False, "error": error_payload}