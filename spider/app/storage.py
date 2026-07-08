import hashlib
import uuid
from datetime import datetime, timezone

import aioboto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app import models
from app.config import settings
from app.db import SessionLocal

_session = aioboto3.Session()


def _client():
    return _session.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


async def ensure_bucket() -> None:
    async with _client() as s3:
        try:
            await s3.head_bucket(Bucket=settings.s3_bucket)
        except ClientError:
            try:
                await s3.create_bucket(Bucket=settings.s3_bucket)
            except ClientError:
                # Race or already-exists; ignore.
                pass


def build_key(url: str) -> str:
    """Deterministic, readable object key for a fetched page."""
    digest = hashlib.sha1(url.encode()).hexdigest()[:16]
    now = datetime.now(timezone.utc)
    return f"raw/{now:%Y/%m/%d}/{digest}.html"


async def put_html(key: str, body: str, url: str) -> None:
    async with _client() as s3:
        await s3.put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=body.encode("utf-8"),
            ContentType="text/html; charset=utf-8",
            Metadata={"source-url": url[:1024]},
        )


async def record_snapshot(
    url: str,
    key: str,
    status_code: int | None = None,
    task_id: uuid.UUID | None = None,
) -> None:
    """Index a stored snapshot in the DB (url -> s3 key, task, status)."""
    async with SessionLocal() as s:
        s.add(
            models.RawSnapshot(
                url=url, s3_key=key, status_code=status_code, task_id=task_id
            )
        )
        await s.commit()
