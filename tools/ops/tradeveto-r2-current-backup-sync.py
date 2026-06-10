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
from botocore.config import Config


@dataclass(frozen=True)
class RemoteTarget:
    remote_name: str
    bucket: str
    prefix: str


class S3Client(Protocol):
    def upload_file(self, Filename: str, Bucket: str, Key: str) -> None:
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
        config=Config(signature_version="s3v4"),
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


def sync_object(client: S3Client, bucket: str, local_path: Path, key: str) -> Mapping[str, object]:
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
    client.upload_file(str(local_path), Bucket=bucket, Key=key)
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
    return parser.parse_args(argv)


def main(argv: Sequence[str]) -> int:
    args = parse_args(argv)
    target = parse_remote(str(args.remote))
    settings = load_remote_config(Path(str(args.rclone_config)), target.remote_name)
    provider = settings.get("provider", "").lower()
    if provider != "cloudflare":
        raise ValueError(f"remote {target.remote_name} is not configured as Cloudflare R2")
    client = build_client(settings)

    results: list[Mapping[str, object]] = []
    for local_value, key_value in args.objects:
        local_path = Path(str(local_value))
        key = object_key(target, str(key_value))
        result = sync_object(client, target.bucket, local_path, key)
        results.append(result)
        print(json.dumps(result, sort_keys=True), flush=True)

    print(json.dumps({"object_count": len(results), "status": "ok"}, sort_keys=True), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
