DELETE FROM scanner_signals newer
USING scanner_signals older
WHERE newer.scan_run_id = older.scan_run_id
  AND newer.symbol = older.symbol
  AND newer.id::text > older.id::text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_scanner_signals_scan_run_symbol'
    ) THEN
        ALTER TABLE scanner_signals
        ADD CONSTRAINT uq_scanner_signals_scan_run_symbol UNIQUE (scan_run_id, symbol);
    END IF;
END $$;
