"""Provider-neutral document object storage.

The default remains Replit Object Storage.  Set ``STORAGE_BACKEND=s3`` to use
an S3-compatible bucket (AWS, MinIO, or another compatible service).  Callers
keep their existing local-disk fallback for legacy uploads.
"""
from __future__ import annotations

import os
from typing import Protocol


class ObjectStorage(Protocol):
    def upload_from_bytes(self, key: str, content: bytes) -> None: ...
    def download_as_bytes(self, key: str) -> bytes: ...
    def delete(self, key: str) -> None: ...


class ReplitObjectStorage:
    def __init__(self) -> None:
        from replit.object_storage import Client
        self._client = Client()

    def upload_from_bytes(self, key: str, content: bytes) -> None:
        self._client.upload_from_bytes(key, content)

    def download_as_bytes(self, key: str) -> bytes:
        return self._client.download_as_bytes(key)

    def delete(self, key: str) -> None:
        self._client.delete(key)


class S3ObjectStorage:
    def __init__(self) -> None:
        bucket = os.getenv("S3_BUCKET", "").strip()
        if not bucket:
            raise RuntimeError("STORAGE_BACKEND=s3 requires S3_BUCKET")
        try:
            import boto3
        except ImportError as exc:
            raise RuntimeError(
                "STORAGE_BACKEND=s3 requires boto3; add boto3 to requirements.txt"
            ) from exc
        self._bucket = bucket
        self._client = boto3.client(
            "s3",
            region_name=os.getenv("S3_REGION") or os.getenv("AWS_REGION"),
            endpoint_url=os.getenv("S3_ENDPOINT_URL") or None,
        )

    def upload_from_bytes(self, key: str, content: bytes) -> None:
        self._client.put_object(Bucket=self._bucket, Key=key, Body=content)

    def download_as_bytes(self, key: str) -> bytes:
        return self._client.get_object(Bucket=self._bucket, Key=key)["Body"].read()

    def delete(self, key: str) -> None:
        self._client.delete_object(Bucket=self._bucket, Key=key)


def get_object_storage() -> ObjectStorage | None:
    """Return the configured provider, or None for legacy local fallback.

    A selected S3 provider fails loudly instead of silently writing user files
    to a different backend.  Replit retains its historical optional behavior.
    """
    backend = os.getenv("STORAGE_BACKEND", "replit").strip().lower()
    if backend == "s3":
        return S3ObjectStorage()
    if backend != "replit":
        raise RuntimeError(f"Unsupported STORAGE_BACKEND: {backend}")
    try:
        return ReplitObjectStorage()
    except Exception:
        return None


# Compatibility alias for callers that need a provider-independent helper.
storage_client = get_object_storage