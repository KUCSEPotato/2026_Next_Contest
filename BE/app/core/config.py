from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Devory API"
    app_version: str = "0.1.0"
    database_url: str = "postgresql+psycopg2://devory:devory1234@127.0.0.1:5432/devory"
    redis_url: str = "redis://127.0.0.1:6379/0"
    frontend_origin: str | None = None
    frontend_url: str | None = None
    jwt_secret_key: str = "change-this-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    github_oauth_client_id: str | None = None
    github_oauth_client_secret: str | None = None
    github_oauth_redirect_uri: str | None = None
    google_oauth_client_id: str | None = None
    google_oauth_client_secret: str | None = None
    google_oauth_redirect_uri: str | None = None
    # AWS S3 Configuration
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_s3_bucket: str | None = None
    aws_s3_region: str = "ap-northeast-2"
    max_file_size_mb: int = 50  # Maximum file size in MB

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
