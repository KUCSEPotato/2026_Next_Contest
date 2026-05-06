from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    nickname: str = Field(min_length=2, max_length=50)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    login_id: str = Field(min_length=2, max_length=255, description="Email or nickname")
    password: str = Field(min_length=8, max_length=128)


class OAuthGithubLoginRequest(BaseModel):
    code: str = Field(min_length=1, description="OAuth authorization code")
    redirect_uri: str | None = None
    nickname: str | None = Field(default=None, min_length=2, max_length=50)


class OAuthGoogleLoginRequest(BaseModel):
    code: str = Field(min_length=1, description="OAuth authorization code")
    redirect_uri: str | None = None
    nickname: str | None = Field(default=None, min_length=2, max_length=50)


class OAuthGithubLinkRequest(BaseModel):
    code: str = Field(min_length=1, description="OAuth authorization code")
    redirect_uri: str | None = None


class OAuthGoogleLinkRequest(BaseModel):
    code: str = Field(min_length=1, description="OAuth authorization code")
    redirect_uri: str | None = None


class TokenRefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class LogoutRequest(BaseModel):
    refresh_token: str | None = None
