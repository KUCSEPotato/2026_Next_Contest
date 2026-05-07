import secrets
from datetime import datetime, timedelta, timezone
import re

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.core.config import settings
from app.core.security import create_access_token
from app.core.security import create_refresh_token
from app.core.security import decode_token
from app.core.security import hash_password
from app.core.security import verify_password
from app.core.token_store import delete_password_reset_token
from app.core.token_store import get_password_reset_token
from app.core.token_store import get_refresh_token_user_id
from app.core.token_store import is_refresh_token_revoked
from app.core.token_store import revoke_access_token
from app.core.token_store import revoke_refresh_token
from app.core.token_store import set_password_reset_token
from app.core.token_store import store_refresh_token
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id
from app.models import User
from app.schemas.auth import ForgotPasswordRequest
from app.schemas.auth import LoginRequest
from app.schemas.auth import LogoutRequest
from app.schemas.auth import OAuthGithubLoginRequest
from app.schemas.auth import OAuthGithubLinkRequest
from app.schemas.auth import OAuthGoogleLoginRequest
from app.schemas.auth import OAuthGoogleLinkRequest
from app.schemas.auth import ResetPasswordRequest
from app.schemas.auth import SignupRequest
from app.schemas.auth import TokenRefreshRequest
from app.services.oauth import exchange_github_code_for_access_token
from app.services.oauth import exchange_google_code_for_access_token
from app.services.oauth import fetch_github_user_profile
from app.services.oauth import fetch_google_user_profile

router = APIRouter()


def _normalize_nickname_seed(raw_value: str | None) -> str:
    if not raw_value:
        return "user"
    normalized = re.sub(r"[^a-zA-Z0-9_]", "", raw_value)
    normalized = normalized.lower()
    if len(normalized) < 2:
        return "user"
    return normalized[:50]


def _build_unique_nickname(db: Session, preferred: str | None, fallback: str) -> str:
    seed = _normalize_nickname_seed(preferred) if preferred else _normalize_nickname_seed(fallback)
    base = seed[:45]
    candidate = base
    index = 1
    while db.query(User).filter(User.nickname == candidate, User.deleted_at.is_(None)).first():
        suffix = str(index)
        candidate = f"{base[:50 - len(suffix)]}{suffix}"
        index += 1
    return candidate


def _create_auth_tokens(user_id: int) -> dict:
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)
    store_refresh_token(refresh_token, user_id)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user_id": user_id,
    }


def _load_active_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def _serialize_user_onboarding(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "nickname": user.nickname,
        "name": user.name,
        "phone_number": user.phone_number,
        "role": user.role,
        "is_verified": user.is_verified,
        "onboarding_step": user.onboarding_step,
        "onboarding_completed_at": user.onboarding_completed_at,
    }


@router.post("/signup", summary="회원가입", description="이메일/아이디/이름/전화번호/비밀번호로 계정을 생성합니다.")
async def signup(payload: SignupRequest, db: Session = Depends(get_db)) -> dict:
    """회원가입 API.

    Swagger 테스트 방법:
    - Request body에 `email`, `login_id`, `name`, `phone_number`, `password`를 입력합니다.
    - 동일 이메일/닉네임이 있으면 `409`를 반환합니다.
    """
    email = payload.email
    login_id = payload.login_id
    name = payload.name
    phone_number = payload.phone_number
    password = payload.password

    if db.query(User).filter(User.email == email, User.deleted_at.is_(None)).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

    if db.query(User).filter(User.nickname == login_id, User.deleted_at.is_(None)).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Login id already exists")

    user = User(
        email=email,
        nickname=login_id,
        name=name,
        phone_number=phone_number,
        password_hash=hash_password(password),
        onboarding_step="profile_pending",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return success_response(
        data={
            **_create_auth_tokens(user.id),
            "user": _serialize_user_onboarding(user),
        },
    )


@router.post("/login", summary="로그인", description="아이디(닉네임) 또는 이메일 + 비밀번호 검증 후 Access/Refresh JWT를 발급합니다.")
async def login(payload: LoginRequest, db: Session = Depends(get_db)) -> dict:
    """로그인 API.

    Swagger 테스트 방법:
    - `login_id`에는 닉네임 또는 이메일을 입력할 수 있습니다.
    - 성공 응답의 `access_token`을 이후 인증 API의 Authorization 헤더에 사용합니다.
    예: `Bearer <access_token>`
    """
    login_id = payload.login_id
    password = payload.password

    user = (
        db.query(User)
        .filter(
            or_(User.email == login_id, User.nickname == login_id),
            User.deleted_at.is_(None),
        )
        .first()
    )
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")

    return success_response(data=_create_auth_tokens(user.id))


@router.post("/oauth/github", summary="GitHub OAuth 로그인", description="GitHub authorization code를 서버에서 검증해 로그인/가입을 처리합니다.")
async def github_oauth_login(payload: OAuthGithubLoginRequest, db: Session = Depends(get_db)) -> dict:
    """GitHub OAuth 로그인 API.

    Swagger 테스트 방법:
    - 프론트엔드에서 GitHub OAuth 인가 후 받은 `code`를 전달합니다.
    - 서버가 GitHub에 code 교환 요청을 보내 사용자 정보를 검증합니다.
    - 최초 로그인 시 `nickname`을 전달하면 우선 사용하고, 없으면 GitHub login/email 기반으로 자동 생성합니다.
    """
    if not settings.github_oauth_client_id or not settings.github_oauth_client_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="GitHub OAuth is not configured")

    redirect_uri = payload.redirect_uri or settings.github_oauth_redirect_uri
    access_token = await exchange_github_code_for_access_token(
        client_id=settings.github_oauth_client_id,
        client_secret=settings.github_oauth_client_secret,
        code=payload.code,
        redirect_uri=redirect_uri,
    )
    profile = await fetch_github_user_profile(access_token)

    github_id = profile.get("provider_id")
    email = profile["email"]
    nickname = payload.nickname
    github_login = profile.get("login")
    avatar_url = profile.get("avatar_url")

    user = None
    if github_id:
        user = db.query(User).filter(User.github_id == github_id, User.deleted_at.is_(None)).first()
    if user is None:
        user = db.query(User).filter(User.email == email, User.deleted_at.is_(None)).first()

    if user is None:
        final_nickname = _build_unique_nickname(db, nickname or github_login, fallback=email.split("@")[0])
        user = User(
            email=email,
            nickname=final_nickname,
            github_id=github_id,
            avatar_url=avatar_url,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if github_id and user.github_id != github_id:
            user.github_id = github_id
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
        user.is_verified = True
        db.commit()

    return success_response(data=_create_auth_tokens(user.id))


@router.post("/oauth/google", summary="Google OAuth 로그인", description="Google authorization code를 서버에서 검증해 로그인/가입을 처리합니다.")
async def google_oauth_login(payload: OAuthGoogleLoginRequest, db: Session = Depends(get_db)) -> dict:
    """Google OAuth 로그인 API.

    Swagger 테스트 방법:
    - 프론트엔드에서 Google OAuth 인가 후 받은 `code`를 전달합니다.
    - 서버가 Google에 code 교환 요청을 보내 사용자 정보를 검증합니다.
    - 최초 로그인 시 `nickname`을 전달하면 우선 사용하고, 없으면 이름/이메일 기반으로 자동 생성합니다.
    """
    if not settings.google_oauth_client_id or not settings.google_oauth_client_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google OAuth is not configured")

    redirect_uri = payload.redirect_uri or settings.google_oauth_redirect_uri
    if not redirect_uri:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="redirect_uri is required")

    access_token = await exchange_google_code_for_access_token(
        client_id=settings.google_oauth_client_id,
        client_secret=settings.google_oauth_client_secret,
        code=payload.code,
        redirect_uri=redirect_uri,
    )
    profile = await fetch_google_user_profile(access_token)
    google_id = profile.get("provider_id")
    email = profile["email"]
    nickname = payload.nickname
    google_name = profile.get("name")
    avatar_url = profile.get("avatar_url")
    is_email_verified = bool(profile.get("email_verified", False))

    user = None
    if google_id:
        user = db.query(User).filter(User.google_id == google_id, User.deleted_at.is_(None)).first()
    if user is None:
        user = db.query(User).filter(User.email == email, User.deleted_at.is_(None)).first()

    if user is None:
        final_nickname = _build_unique_nickname(db, nickname or google_name, fallback=email.split("@")[0])
        user = User(
            email=email,
            nickname=final_nickname,
            google_id=google_id,
            avatar_url=avatar_url,
            is_verified=is_email_verified,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if google_id and user.google_id != google_id:
            user.google_id = google_id
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
        if is_email_verified and not user.is_verified:
            user.is_verified = True
        db.commit()

    return success_response(data=_create_auth_tokens(user.id))


@router.get("/oauth/links", summary="연결된 OAuth 계정 조회", description="현재 사용자 계정에 연결된 OAuth provider 상태를 조회합니다.")
async def get_oauth_links(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    user = _load_active_user(db, current_user_id)
    return success_response(
        data={
            "github_linked": bool(user.github_id),
            "google_linked": bool(user.google_id),
        },
    )


@router.post("/oauth/link/github", summary="GitHub 계정 연결", description="현재 로그인 계정에 GitHub OAuth 계정을 연결합니다.")
async def link_github_oauth(
    payload: OAuthGithubLinkRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    if not settings.github_oauth_client_id or not settings.github_oauth_client_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="GitHub OAuth is not configured")

    user = _load_active_user(db, current_user_id)
    redirect_uri = payload.redirect_uri or settings.github_oauth_redirect_uri
    access_token = await exchange_github_code_for_access_token(
        client_id=settings.github_oauth_client_id,
        client_secret=settings.github_oauth_client_secret,
        code=payload.code,
        redirect_uri=redirect_uri,
    )
    profile = await fetch_github_user_profile(access_token)
    github_id = profile.get("provider_id")
    email = profile["email"]

    if email.lower() != user.email.lower():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth account email must match your account email")
    if not github_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid GitHub account id")

    existing = db.query(User).filter(User.github_id == github_id, User.id != user.id, User.deleted_at.is_(None)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="GitHub account already linked to another user")

    user.github_id = github_id
    if not user.avatar_url and profile.get("avatar_url"):
        user.avatar_url = profile.get("avatar_url")
    user.is_verified = True
    db.commit()

    return success_response(data={"github_linked": True})


@router.post("/oauth/link/google", summary="Google 계정 연결", description="현재 로그인 계정에 Google OAuth 계정을 연결합니다.")
async def link_google_oauth(
    payload: OAuthGoogleLinkRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    if not settings.google_oauth_client_id or not settings.google_oauth_client_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google OAuth is not configured")

    user = _load_active_user(db, current_user_id)
    redirect_uri = payload.redirect_uri or settings.google_oauth_redirect_uri
    if not redirect_uri:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="redirect_uri is required")

    access_token = await exchange_google_code_for_access_token(
        client_id=settings.google_oauth_client_id,
        client_secret=settings.google_oauth_client_secret,
        code=payload.code,
        redirect_uri=redirect_uri,
    )
    profile = await fetch_google_user_profile(access_token)
    google_id = profile.get("provider_id")
    email = profile["email"]

    if email.lower() != user.email.lower():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth account email must match your account email")
    if not google_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Google account id")

    existing = db.query(User).filter(User.google_id == google_id, User.id != user.id, User.deleted_at.is_(None)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Google account already linked to another user")

    user.google_id = google_id
    if not user.avatar_url and profile.get("avatar_url"):
        user.avatar_url = profile.get("avatar_url")
    if profile.get("email_verified"):
        user.is_verified = True
    db.commit()

    return success_response(data={"google_linked": True})


@router.delete("/oauth/unlink/github", summary="GitHub 계정 연결 해제", description="현재 로그인 계정에서 GitHub OAuth 연결을 해제합니다.")
async def unlink_github_oauth(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    user = _load_active_user(db, current_user_id)
    if not user.github_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="GitHub account is not linked")

    if not user.password_hash and not user.google_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot unlink the last login method")

    user.github_id = None
    db.commit()
    return success_response(data={"github_linked": False})


@router.delete("/oauth/unlink/google", summary="Google 계정 연결 해제", description="현재 로그인 계정에서 Google OAuth 연결을 해제합니다.")
async def unlink_google_oauth(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    user = _load_active_user(db, current_user_id)
    if not user.google_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google account is not linked")

    if not user.password_hash and not user.github_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot unlink the last login method")

    user.google_id = None
    db.commit()
    return success_response(data={"google_linked": False})


@router.post("/logout", summary="로그아웃", description="Access/Refresh 토큰을 폐기하여 재사용과 재발급을 차단합니다.")
async def logout(payload: LogoutRequest, authorization: str | None = Header(default=None)) -> dict:
    """로그아웃 API.

    Swagger 테스트 방법:
    - `Authorization: Bearer <access_token>` 헤더를 함께 보내면 현재 access token을 즉시 무효화합니다.
    - body의 `refresh_token`을 전달하면 refresh token도 함께 폐기합니다.
    """
    if authorization and authorization.lower().startswith("bearer "):
        access_token = authorization.split(" ", 1)[1].strip()
        try:
            access_payload = decode_token(access_token)
            expires_at = datetime.fromtimestamp(int(access_payload["exp"]), tz=timezone.utc)
        except HTTPException:
            expires_at = None
        revoke_access_token(access_token, expires_at=expires_at)

    if payload.refresh_token:
        try:
            refresh_payload = decode_token(payload.refresh_token)
            refresh_expires_at = datetime.fromtimestamp(int(refresh_payload["exp"]), tz=timezone.utc)
        except HTTPException:
            refresh_expires_at = None
        revoke_refresh_token(payload.refresh_token, expires_at=refresh_expires_at)
    return success_response(data={"logged_out": True})


@router.post("/token/refresh", summary="Access Token 재발급", description="유효한 Refresh 토큰으로 새 Access 토큰을 발급합니다.")
async def refresh_token(payload: TokenRefreshRequest) -> dict:
    """토큰 재발급 API.

    Swagger 테스트 방법:
    - 로그인 응답에서 받은 `refresh_token`을 body에 전달합니다.
    - 폐기된 토큰 또는 만료된 토큰이면 `401`을 반환합니다.
    """
    token = payload.refresh_token
    if is_refresh_token_revoked(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked")

    user_id = get_refresh_token_user_id(token)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown refresh token")

    token_payload = decode_token(token)
    if token_payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token type")

    return success_response(data={"access_token": create_access_token(user_id), "token_type": "bearer"})


@router.post("/password/forgot", summary="비밀번호 재설정 요청", description="계정이 존재하면 임시 재설정 토큰을 발급합니다.")
async def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> dict:
    """비밀번호 재설정 요청 API.

    Swagger 테스트 방법:
    - 가입된 이메일을 전달하면 `reset_token`을 응답으로 확인할 수 있습니다.
    - 실제 운영에서는 메일 발송 연동으로 대체해야 합니다.
    """
    email = payload.email

    user = db.query(User).filter(User.email == email, User.deleted_at.is_(None)).first()
    if user:
        token = secrets.token_urlsafe(32)
        set_password_reset_token(token, user.id, datetime.now(timezone.utc) + timedelta(minutes=15))
    else:
        token = None

    return success_response(
        data={"reset_token": token, "message": "If account exists, reset was created"},
    )


@router.post("/password/reset", summary="비밀번호 재설정", description="재설정 토큰 검증 후 비밀번호를 변경합니다.")
async def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> dict:
    """비밀번호 재설정 API.

    Swagger 테스트 방법:
    - `/password/forgot`에서 받은 `token`과 새 비밀번호를 전달합니다.
    - 성공 시 기존 비밀번호로는 로그인할 수 없습니다.
    """
    token = payload.token
    new_password = payload.new_password

    token_data = get_password_reset_token(token)
    if token_data is None or token_data["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    user = db.get(User, token_data["user_id"])
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.password_hash = hash_password(new_password)
    db.commit()
    delete_password_reset_token(token)

    return success_response(
        data={"password_reset": True},
    )


@router.get("/me", summary="내 인증 정보 조회", description="Bearer Access 토큰으로 현재 사용자 정보를 조회합니다.")
async def get_my_auth_info(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """내 인증 정보 조회 API.

    Swagger 테스트 방법:
    - 헤더 `Authorization: Bearer <access_token>`를 설정합니다.
    - 토큰이 유효하지 않거나 만료되면 `401`을 반환합니다.
    """
    user = db.get(User, current_user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return success_response(
        data={
            "id": user.id,
            "email": user.email,
            "nickname": user.nickname,
            "name": user.name,
            "phone_number": user.phone_number,
            "coin_balance": user.coin_balance,
            "role": user.role,
            "is_verified": user.is_verified,
            "onboarding_step": user.onboarding_step,
            "onboarding_completed_at": user.onboarding_completed_at,
        },
    )
