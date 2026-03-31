from fastapi import APIRouter

router = APIRouter()


@router.post("/signup")
async def signup() -> dict:
    return {"message": "TODO: signup"}


@router.post("/login")
async def login() -> dict:
    return {"message": "TODO: login"}


@router.post("/oauth/github")
async def github_oauth_login() -> dict:
    return {"message": "TODO: github oauth login"}


@router.post("/logout")
async def logout() -> dict:
    return {"message": "TODO: logout"}


@router.post("/token/refresh")
async def refresh_token() -> dict:
    return {"message": "TODO: refresh token"}


@router.get("/me")
async def get_my_auth_info() -> dict:
    return {"message": "TODO: auth me"}
