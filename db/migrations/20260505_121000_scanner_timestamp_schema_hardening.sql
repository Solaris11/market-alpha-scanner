CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    IF to_regclass('public.scan_runs') IS NOT NULL THEN
        ALTER TABLE scan_runs
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
    END IF;

    IF to_regclass('public.scanner_signals') IS NOT NULL THEN
        ALTER TABLE scanner_signals
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

        CREATE INDEX IF NOT EXISTS idx_scanner_signals_created_at
        ON scanner_signals(created_at);
    END IF;
END $$;
