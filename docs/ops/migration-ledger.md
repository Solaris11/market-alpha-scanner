# Migration Ledger Runbook

Migration files live in `db/migrations` and use the canonical filename format:

```text
YYYYMMDD_HHMMSS_description.sql
```

The production ledger table is `schema_migrations`.

## Runner

Run migrations from the app repo root:

```bash
tools/db/run-migrations.sh
```

Behavior:

- creates `schema_migrations` if missing
- records migration filenames in sorted order
- applies only files not present in `schema_migrations`
- wraps each migration and ledger insert in one transaction
- fails closed on the first SQL error

For an already-live database with no ledger, the runner bootstraps by recording all current migration files without replaying old SQL. This avoids destructive reapplication of historical migrations that were already applied manually before the ledger existed.

## Phase 5.4 Rename Mapping

| Old filename | New filename |
| --- | --- |
| `0001_db_foundation.sql` | `20260505_120100_db_foundation.sql` |
| `0002_paper_trading.sql` | `20260505_120200_paper_trading.sql` |
| `0003_scanner_signal_uniqueness.sql` | `20260505_120300_scanner_signal_uniqueness.sql` |
| `0004_paper_trade_lifecycle.sql` | `20260505_120400_paper_trade_lifecycle.sql` |
| `0005_identity_account_scope.sql` | `20260505_120500_identity_account_scope.sql` |
| `0006_production_auth_profile.sql` | `20260505_120600_production_auth_profile.sql` |
| `0007_google_oauth_accounts.sql` | `20260505_120700_google_oauth_accounts.sql` |
| `0008_session_hash_entitlements.sql` | `20260505_120800_session_hash_entitlements.sql` |
| `0009_paper_schema_hardening.sql` | `20260505_120900_paper_schema_hardening.sql` |
| `0010_scanner_timestamp_schema_hardening.sql` | `20260505_121000_scanner_timestamp_schema_hardening.sql` |
| `0011_legal_documents_acceptances.sql` | `20260505_121100_legal_documents_acceptances.sql` |
| `0012_notifications.sql` | `20260505_121200_notifications.sql` |
| `0013_stripe_billing.sql` | `20260505_121300_stripe_billing.sql` |
| `0014_email_verification.sql` | `20260505_121400_email_verification.sql` |
| `0015_notification_actions.sql` | `20260505_121500_notification_actions.sql` |
| `0016_stripe_subscription_lifecycle.sql` | `20260505_121600_stripe_subscription_lifecycle.sql` |
| `0017_alert_rules_persistence.sql` | `20260505_121700_alert_rules_persistence.sql` |
| `0018_distributed_rate_limits.sql` | `20260505_121800_distributed_rate_limits.sql` |
| `0019_stripe_webhook_idempotency.sql` | `20260505_121900_stripe_webhook_idempotency.sql` |
| `0020_monitoring_tables.sql` | `20260505_122000_monitoring_tables.sql` |
| `0021_scanner_db_source_of_truth.sql` | `20260505_122100_scanner_db_source_of_truth.sql` |
| `0022_admin_console.sql` | `20260505_122200_admin_console.sql` |
| `0022_rate_limit_index_cleanup.sql` | `20260505_122300_rate_limit_index_cleanup.sql` |
| `0023_support_center.sql` | `20260505_122400_support_center.sql` |
