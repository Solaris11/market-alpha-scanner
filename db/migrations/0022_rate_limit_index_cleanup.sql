-- Phase 4.11.9: keep the migration-owned expires_at index and remove the
-- duplicate ad hoc index created during production hygiene.
DROP INDEX IF EXISTS idx_rate_limit_expires_at;
