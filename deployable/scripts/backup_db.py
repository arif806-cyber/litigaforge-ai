#!/usr/bin/env python3
"""Encrypt a pg_dump stream with age before uploading ciphertext to S3."""
import os
import subprocess
import tempfile
from datetime import datetime, timezone

import boto3


def required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"{name} is required")
    return value


def main() -> None:
    database_url = required("DATABASE_URL")
    recipient = required("BACKUP_AGE_RECIPIENT")
    bucket = required("BACKUP_S3_BUCKET")
    key = os.getenv("BACKUP_S3_PREFIX", "litigaforge/db").strip("/ ")
    key = f"{key}/{datetime.now(timezone.utc):%Y/%m/%d}/litigaforge-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}.dump.age"
    with tempfile.TemporaryFile() as encrypted:
        dump = subprocess.Popen(["pg_dump", "--format=custom", "--no-owner", database_url], stdout=subprocess.PIPE)
        age = subprocess.Popen(["age", "-r", recipient], stdin=dump.stdout, stdout=encrypted)
        assert dump.stdout is not None
        dump.stdout.close()
        age_code = age.wait()
        dump_code = dump.wait()
        if dump_code or age_code:
            raise SystemExit(f"backup pipeline failed (pg_dump={dump_code}, age={age_code})")
        encrypted.seek(0)
        boto3.client(
            "s3",
            endpoint_url=os.getenv("BACKUP_S3_ENDPOINT_URL") or None,
            region_name=os.getenv("BACKUP_S3_REGION") or None,
            aws_access_key_id=os.getenv("BACKUP_S3_ACCESS_KEY_ID") or os.getenv("S3_ACCESS_KEY_ID") or None,
            aws_secret_access_key=os.getenv("BACKUP_S3_SECRET_ACCESS_KEY") or os.getenv("S3_SECRET_ACCESS_KEY") or None,
        ).upload_fileobj(encrypted, bucket, key)
    print(f"Encrypted database backup uploaded: s3://{bucket}/{key}")


if __name__ == "__main__":
    main()
