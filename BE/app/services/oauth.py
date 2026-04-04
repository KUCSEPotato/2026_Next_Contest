from __future__ import annotations

from typing import Any

import httpx
from fastapi import HTTPException, status


async def exchange_github_code_for_access_token(
    *,
    client_id: str,
    client_secret: str,
    code: str,
    redirect_uri: str | None,
) -> str:
    payload: dict[str, Any] = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
    }
    if redirect_uri:
        payload["redirect_uri"] = redirect_uri

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            "https://github.com/login/oauth/access_token",
            data=payload,
            headers={"Accept": "application/json"},
        )

    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="GitHub token exchange failed")

    data = response.json()
    access_token = data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid GitHub authorization code")
    return access_token


async def fetch_github_user_profile(access_token: str) -> dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        user_response = await client.get("https://api.github.com/user", headers=headers)
    if user_response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unable to fetch GitHub user profile")

    user_data = user_response.json()
    email = user_data.get("email")
    if not email:
        async with httpx.AsyncClient(timeout=10.0) as client:
            emails_response = await client.get("https://api.github.com/user/emails", headers=headers)
        if emails_response.status_code == 200:
            emails = emails_response.json()
            primary = next((e for e in emails if e.get("primary") and e.get("verified")), None)
            fallback = next((e for e in emails if e.get("verified")), None)
            selected = primary or fallback
            if selected:
                email = selected.get("email")

    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="GitHub account email is required")

    return {
        "provider_id": str(user_data.get("id")) if user_data.get("id") is not None else None,
        "email": email,
        "login": user_data.get("login"),
        "avatar_url": user_data.get("avatar_url"),
        "name": user_data.get("name"),
    }


async def exchange_google_code_for_access_token(
    *,
    client_id: str,
    client_secret: str,
    code: str,
    redirect_uri: str,
) -> str:
    payload = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post("https://oauth2.googleapis.com/token", data=payload)

    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google token exchange failed")

    data = response.json()
    access_token = data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google authorization code")
    return access_token


async def fetch_google_user_profile(access_token: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unable to fetch Google user profile")

    data = response.json()
    email = data.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google account email is required")

    return {
        "provider_id": data.get("sub"),
        "email": email,
        "name": data.get("name"),
        "avatar_url": data.get("picture"),
        "email_verified": bool(data.get("email_verified", False)),
    }
