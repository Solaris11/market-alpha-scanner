CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE scan_runs
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE scanner_signals
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_scanner_signals_created_at
ON scanner_signals(created_at);
