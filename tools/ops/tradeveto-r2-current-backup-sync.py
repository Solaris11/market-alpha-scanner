#!/usr/bin/env python3
# pyright: reportMissingImports=false
from __future__ import annotations

import argparse
import configparser
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Protocol, Sequence

import boto3
from boto3.s3.transfer import TransferConfig
from botocore.config import Config


@dataclass(frozen=True)
class RemoteTarget:
    remote_name: str
    bucket: str
    prefix: str


class S3Client(Protocol):
    def upload_file(self, Filename: str, Bucket: str, Key: str, Config: object | None = None) -> None:
        ...

    def head_object(self, Bucket: str, Key: str) -> Mapping[str, object]:
        ...


def parse_remote(remote: str) -> RemoteTarget:
    if ":" not in remote:
        raise ValueError(f"Unsupported rclone remote format: {remote}")
    remote_name, path = remote.split(":", 1)
    normalized = path.strip("/")
    if not remote_name or not normalized:
        raise ValueError(f"Unsupported rclone remote format: {remote}")
    bucket, _, prefix = normalized.partition("/")
    if not bucket:
        raise ValueError(f"Missing bucket in rclone remote: {remote}")
    return RemoteTarget(remote_name=remote_name, bucket=bucket, prefix=prefix.strip("/"))


def load_remote_config(config_path: Path, remote_name: str) -> Mapping[str, str]:
    parser = configparser.ConfigParser()
    read_files = parser.read(config_path)
    if not read_files:
        raise FileNotFoundError(f"rclone config not found: {config_path}")
    if remote_name not in parser:
        raise KeyError(f"rclone remote not found: {remote_name}")
    return {key: value for key, value in parser[remote_name].items()}


def build_client(settings: Mapping[str, str]) -> S3Client:
    endpoint = settings.get("endpoint")
    access_key = settings.get("access_key_id")
    secret_key = settings.get("secret_access_key")
    region = settings.get("region") or "auto"
    if not endpoint or not access_key or not secret_key:
        raise ValueError("rclone R2 config is missing endpoint, access_key_id, or secret_access_key")
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region,
        config=Config(
            signature_version="s3v4",
            retries={"max_attempts": 10, "mode": "standard"},
            connect_timeout=20,
            read_timeout=300,
        ),
    )


def object_key(target: RemoteTarget, requested_key: str) -> str:
    clean_key = requested_key.strip("/")
    if not clean_key:
        raise ValueError("empty remote object key")
    if target.prefix:
        return f"{target.prefix}/{clean_key}"
    return clean_key


def object_size(client: S3Client, bucket: str, key: str) -> int | None:
    try:
        response = client.head_object(Bucket=bucket, Key=key)
    except Exception:
        return None
    value = response.get("ContentLength")
    return int(value) if isinstance(value, int) else None


def sync_object(
    client: S3Client,
    bucket: str,
    local_path: Path,
    key: str,
    transfer_config: object,
) -> Mapping[str, object]:
    if not local_path.is_file():
        raise FileNotFoundError(f"local backup file not found: {local_path}")
    local_size = local_path.stat().st_size
    existing_size = object_size(client, bucket, key)
    if existing_size == local_size:
        return {
            "bucket": bucket,
            "bytes": local_size,
            "key": key,
            "local_path": str(local_path),
            "status": "already_present",
        }
    print(
        json.dumps(
            {
                "bucket": bucket,
                "bytes": local_size,
                "key": key,
                "local_path": str(local_path),
                "status": "uploading",
            },
            sort_keys=True,
        ),
        flush=True,
    )
    client.upload_file(str(local_path), Bucket=bucket, Key=key, Config=transfer_config)
    verified_size = object_size(client, bucket, key)
    if verified_size != local_size:
        raise RuntimeError(f"R2 object size mismatch for {key}: local={local_size} remote={verified_size}")
    return {
        "bucket": bucket,
        "bytes": local_size,
        "key": key,
        "local_path": str(local_path),
        "status": "uploaded",
    }


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync current TradeVeto backup artifacts to Cloudflare R2 using boto3.")
    parser.add_argument("--remote", required=True, help="Rclone-style R2 remote, for example r2:market-alpha-backups")
    parser.add_argument(
        "--rclone-config",
        default=os.environ.get("RCLONE_CONFIG", str(Path.home() / ".config" / "rclone" / "rclone.conf")),
        help="Path to rclone config containing the R2 credentials.",
    )
    parser.add_argument(
        "--object",
        action="append",
        dest="objects",
        metavar=("LOCAL_PATH", "REMOTE_KEY"),
        nargs=2,
        required=True,
        help="Local file and remote key under the R2 bucket or configured prefix. Repeat for multiple files.",
    )
    parser.add_argument(
        "--max-concurrency",
        default=os.environ.get("TRADEVETO_R2_MAX_CONCURRENCY", "1"),
        help="S3 multipart upload concurrency. Default: 1 for stable R2 backup uploads.",
    )
    parser.add_argument(
        "--multipart-chunk-mb",
        default=os.environ.get("TRADEVETO_R2_MULTIPART_CHUNK_MB", "64"),
        help="Multipart chunk size in MiB. Default: 64.",
    )
    return parser.parse_args(argv)


def positive_int(value: object, label: str) -> int:
    try:
        parsed = int(str(value))
    except ValueError as exc:
        raise ValueError(f"{label} must be an integer") from exc
    if parsed <= 0:
        raise ValueError(f"{label} must be positive")
    return parsed


def main(argv: Sequence[str]) -> int:
    args = parse_args(argv)
    target = parse_remote(str(args.remote))
    settings = load_remote_config(Path(str(args.rclone_config)), target.remote_name)
    provider = settings.get("provider", "").lower()
    if provider != "cloudflare":
        raise ValueError(f"remote {target.remote_name} is not configured as Cloudflare R2")
    client = build_client(settings)
    max_concurrency = positive_int(args.max_concurrency, "max concurrency")
    chunk_mb = positive_int(args.multipart_chunk_mb, "multipart chunk MiB")
    chunk_bytes = chunk_mb * 1024 * 1024
    transfer_config = TransferConfig(
        multipart_threshold=chunk_bytes,
        multipart_chunksize=chunk_bytes,
        max_concurrency=max_concurrency,
        use_threads=max_concurrency > 1,
    )

    results: list[Mapping[str, object]] = []
    for local_value, key_value in args.objects:
        local_path = Path(str(local_value))
        key = object_key(target, str(key_value))
        result = sync_object(client, target.bucket, local_path, key, transfer_config)
        results.append(result)
        print(json.dumps(result, sort_keys=True), flush=True)

    print(json.dumps({"object_count": len(results), "status": "ok"}, sort_keys=True), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
