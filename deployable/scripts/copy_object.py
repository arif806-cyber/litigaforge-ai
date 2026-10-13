#!/usr/bin/env python3
"""Copy encrypted backup objects between S3-compatible and Replit Object Storage."""
import os
import sys

import boto3


def main() -> None:
    if len(sys.argv) != 5:
        raise SystemExit("usage: copy_object.py SOURCE_BACKEND SOURCE_BUCKET SOURCE_KEY DESTINATION_BACKEND")
    source_backend, source_bucket, source_key, destination_backend = sys.argv[1:]
    if source_backend == "s3":
        source = boto3.client(
            "s3",
            endpoint_url=os.getenv("SOURCE_S3_ENDPOINT_URL") or None,
            region_name=os.getenv("SOURCE_S3_REGION") or None,
            aws_access_key_id=os.getenv("SOURCE_S3_ACCESS_KEY_ID") or None,
            aws_secret_access_key=os.getenv("SOURCE_S3_SECRET_ACCESS_KEY") or None,
        )
        body = source.get_object(Bucket=source_bucket, Key=source_key)["Body"]
        data = body.read()
        body.close()
    elif source_backend == "replit":
        from replit.object_storage import Client
        data = Client().download_as_bytes(source_key)
    else:
        raise SystemExit("source backend must be s3 or replit")

    if destination_backend == "s3":
        bucket = os.getenv("DESTINATION_S3_BUCKET", "").strip()
        if not bucket:
            raise SystemExit("DESTINATION_S3_BUCKET is required")
        boto3.client(
            "s3",
            endpoint_url=os.getenv("DESTINATION_S3_ENDPOINT_URL") or None,
            region_name=os.getenv("DESTINATION_S3_REGION") or None,
            aws_access_key_id=os.getenv("DESTINATION_S3_ACCESS_KEY_ID") or os.getenv("S3_ACCESS_KEY_ID") or None,
            aws_secret_access_key=os.getenv("DESTINATION_S3_SECRET_ACCESS_KEY") or os.getenv("S3_SECRET_ACCESS_KEY") or None,
        ).put_object(
                         Bucket=bucket, Key=source_key, Body=data)
    elif destination_backend == "replit":
        from replit.object_storage import Client
        Client().upload_from_bytes(source_key, data)
    else:
        raise SystemExit("destination backend must be s3 or replit")
    print(f"Copied {source_backend}:{source_bucket}/{source_key} to {destination_backend}")


if __name__ == "__main__":
    main()
