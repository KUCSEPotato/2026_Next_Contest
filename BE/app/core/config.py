from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Devory API"
    app_version: str = "0.1.0"
    database_url: str = "postgresql+psycopg2://devory:devory1234@127.0.0.1:5432/devory"
    redis_url: str = "redis://127.0.0.1:6379/0"
    jwt_secret_key: str = "change-this-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    github_oauth_client_id: str | None = None
    github_oauth_client_secret: str | None = None
    github_oauth_redirect_uri: str | None = None
    google_oauth_client_id: str | None = None
    google_oauth_client_secret: str | None = None
    google_oauth_redirect_uri: str | None = None

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
