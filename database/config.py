from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


DEFAULT_SCANNER_OUTPUT_DIR = "/opt/apps/market-alpha-scanner/runtime/scanner_output"
DEFAULT_APP_LOG_DIR = "/opt/apps/market-alpha-scanner/runtime/logs"


@dataclass(frozen=True)
class AppConfig:
    database_url: str | None
    scanner_output_dir: Path
    app_log_dir: Path


def load_app_config() -> AppConfig:
    database_url = os.getenv("DATABASE_URL", "").strip() or None
    scanner_output_dir = Path(os.getenv("SCANNER_OUTPUT_DIR", DEFAULT_SCANNER_OUTPUT_DIR)).expanduser()
    app_log_dir = Path(os.getenv("APP_LOG_DIR", DEFAULT_APP_LOG_DIR)).expanduser()
    return AppConfig(
        database_url=database_url,
        scanner_output_dir=scanner_output_dir,
        app_log_dir=app_log_dir,
    )


def get_database_url(required: bool = True) -> str | None:
    config = load_app_config()
    if config.database_url:
        return config.database_url
    if required:
        raise RuntimeError("DATABASE_URL is not set. Configure it in the environment or .env file.")
    return None
