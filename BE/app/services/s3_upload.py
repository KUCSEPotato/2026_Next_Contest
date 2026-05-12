"""S3 file upload service."""

import os
from io import BytesIO
from pathlib import Path
from urllib.parse import unquote, urlparse
from uuid import uuid4

import boto3
from botocore.config import Config
from fastapi import HTTPException, status

from app.core.config import settings


class S3FileUploadService:
    """Service for uploading files to AWS S3."""

    def __init__(self):
        if not settings.aws_access_key_id or not settings.aws_secret_access_key or not settings.aws_s3_bucket:
            raise RuntimeError("AWS S3 credentials not configured")

        s3_region = settings.aws_s3_region or "ap-northeast-2"

        self.s3_client = boto3.client(
            "s3",
            region_name=s3_region,
            endpoint_url=f"https://s3.{s3_region}.amazonaws.com",
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "virtual"},
            ),
        )
        self.bucket_name = settings.aws_s3_bucket
        self.region_name = s3_region

    async def upload_file(
        self,
        file_content: bytes,
        filename: str,
        file_type: str,
        folder: str,  # e.g., "community" or "ideas"
    ) -> dict:
        """Upload a file to S3 and return S3 key and raw object URL.

        Args:
            file_content: File binary content
            filename: Original filename
            file_type: MIME type (e.g., "image/png", "application/pdf")
            folder: Folder in S3 bucket ("community" or "ideas")

        Returns:
            {
                "s3_key": "community/2026-05-08-uuid-filename.pdf",
                "s3_url": "https://bucket.s3.ap-northeast-2.amazonaws.com/...",
                "file_size": 12345,
            }

        Raises:
            HTTPException: If file size exceeds limit or upload fails
        """
        # Validate file size
        file_size = len(file_content)
        max_size_bytes = settings.max_file_size_mb * 1024 * 1024
        if file_size > max_size_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds {settings.max_file_size_mb}MB limit",
            )

        # Generate unique filename
        unique_id = str(uuid4())[:8]
        base_name = os.path.splitext(filename)[0]
        ext = os.path.splitext(filename)[1]
        s3_filename = f"{base_name}-{unique_id}{ext}"
        s3_key = f"{folder}/{s3_filename}"

        try:
            # Upload to S3
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=file_content,
                ContentType=file_type,
            )

            # Generate public URL
            s3_url = f"https://{self.bucket_name}.s3.{self.region_name}.amazonaws.com/{s3_key}"

            return {
                "s3_key": s3_key,
                "s3_url": s3_url,
                "file_size": file_size,
            }
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"File upload failed: {str(e)}",
            )

    async def upload_avatar(
        self,
        file_content: bytes,
        user_id: int,
        filename: str,
        file_type: str,
    ) -> dict:
        """Upload an avatar with an ASCII-only UUID object key.

        Original filenames are intentionally not included in the object key.
        Non-ASCII filenames can break SigV4 verification when clients or
        proxies normalize/encode the presigned URL differently.
        """
        file_size = len(file_content)
        max_size_bytes = settings.max_file_size_mb * 1024 * 1024
        if file_size > max_size_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds {settings.max_file_size_mb}MB limit",
            )

        ext = Path(filename or "").suffix.lower()
        allowed_exts = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
        if ext not in allowed_exts:
            content_type_exts = {
                "image/jpeg": ".jpg",
                "image/jpg": ".jpg",
                "image/png": ".png",
                "image/webp": ".webp",
                "image/gif": ".gif",
            }
            ext = content_type_exts.get(file_type, "")

        s3_key = f"avatars/{user_id}/{uuid4().hex}{ext}"

        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=file_content,
                ContentType=file_type,
            )

            return {
                "s3_key": s3_key,
                "file_size": file_size,
            }
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Avatar upload failed: {str(e)}",
            )

    def generate_presigned_get_url(self, s3_key: str, expires_in: int = 3600) -> str:
        """Generate a temporary GET URL for a private S3 object."""
        try:
            return self.s3_client.generate_presigned_url(
                ClientMethod="get_object",
                Params={
                    "Bucket": self.bucket_name,
                    "Key": s3_key,
                },
                ExpiresIn=expires_in,
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate presigned URL: {str(e)}",
            )

    async def delete_file(self, s3_key: str) -> None:
        """Delete a file from S3.

        Args:
            s3_key: S3 object key (path)

        Raises:
            HTTPException: If deletion fails
        """
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=s3_key)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"File deletion failed: {str(e)}",
            )

    def get_s3_service():
        """Dependency to get S3 service instance."""
        try:
            return S3FileUploadService()
        except RuntimeError:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="AWS S3 service not configured",
            )


# Helper function for dependency injection
def get_s3_service() -> S3FileUploadService:
    """Get S3 service instance. Can be used as a FastAPI dependency."""
    try:
        return S3FileUploadService()
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AWS S3 service not configured",
        )


def extract_s3_key_from_url(url: str | None) -> str | None:
    """Extract object key from common S3 object URL shapes."""
    if not url:
        return None

    parsed = urlparse(url)
    if not parsed.netloc or not parsed.path:
        return None

    path = unquote(parsed.path.lstrip("/"))
    bucket = settings.aws_s3_bucket

    if ".amazonaws.com" not in parsed.netloc:
        return None

    if bucket and parsed.netloc.startswith(f"{bucket}."):
        return path or None

    if bucket and path.startswith(f"{bucket}/"):
        return path[len(bucket) + 1 :] or None

    return path or None


def generate_presigned_get_url(s3_key: str | None, expires_in: int = 3600) -> str | None:
    """Generate a temporary GET URL for a private S3 object key."""
    if not s3_key:
        return None
    return get_s3_service().generate_presigned_get_url(s3_key, expires_in=expires_in)


def resolve_avatar_url(
    avatar_s3_key: str | None,
    avatar_url: str | None,
    expires_in: int = 3600,
) -> str | None:
    """Return the API-facing avatar URL.

    Private S3 avatars are always returned as temporary presigned GET URLs.
    Raw S3 object URLs are treated as fallback input only and converted to a
    presigned URL when their object key can be extracted.
    Non-S3 external URLs, such as OAuth provider avatars, are returned as-is.
    """
    s3_key = avatar_s3_key or extract_s3_key_from_url(avatar_url)
    if s3_key:
        return generate_presigned_get_url(s3_key, expires_in=expires_in)

    return avatar_url
