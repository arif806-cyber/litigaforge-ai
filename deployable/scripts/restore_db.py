#!/usr/bin/env python3
"""Restore an encrypted S3 dump directly into pg_restore; plaintext is never written to disk."""
import os
import subprocess
import sys

import boto3


def required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"{name} is required")
    return value


def main() -> None:
    if "--confirm" not in sys.argv:
        raise SystemExit("This overwrites database objects. Re-run with --confirm after checking DATABASE_URL.")
    identity = required("BACKUP_AGE_IDENTITY_FILE")
    bucket, key = required("BACKUP_S3_BUCKET"), required("BACKUP_S3_KEY")
    destination = required("DATABASE_URL")
    obj = boto3.client(
        "s3",
        endpoint_url=os.getenv("BACKUP_S3_ENDPOINT_URL") or None,
        region_name=os.getenv("BACKUP_S3_REGION") or None,
        aws_access_key_id=os.getenv("BACKUP_S3_ACCESS_KEY_ID") or os.getenv("S3_ACCESS_KEY_ID") or None,
        aws_secret_access_key=os.getenv("BACKUP_S3_SECRET_ACCESS_KEY") or os.getenv("S3_SECRET_ACCESS_KEY") or None,
    ).get_object(Bucket=bucket, Key=key)
    age = subprocess.Popen(["age", "-d", "-i", identity], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    assert age.stdin is not None and age.stdout is not None
    restore = subprocess.Popen(["pg_restore", "--clean", "--if-exists", "--no-owner", "--dbname", destination],
                               stdin=age.stdout)
    age.stdout.close()
    try:
        while chunk := obj["Body"].read(1024 * 1024):
            age.stdin.write(chunk)
    finally:
        age.stdin.close()
        obj["Body"].close()
    age_code, restore_code = age.wait(), restore.wait()
    if age_code or restore_code:
        raise SystemExit(f"restore failed (age={age_code}, pg_restore={restore_code})")
    print(f"Restored s3://{bucket}/{key}")


if __name__ == "__main__":
    main()
