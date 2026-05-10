CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS developer_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_developer_api_keys_user_created
  ON developer_api_keys(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_developer_api_keys_key_hash
  ON developer_api_keys(key_hash);

CREATE TABLE IF NOT EXISTS developer_webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  event_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  signing_secret text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_delivery_status text,
  last_delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT developer_webhook_endpoints_status_check CHECK (last_delivery_status IS NULL OR last_delivery_status IN ('pending', 'delivered', 'failed'))
);

CREATE INDEX IF NOT EXISTS ix_developer_webhook_endpoints_user_active
  ON developer_webhook_endpoints(user_id, active, created_at DESC);

CREATE TABLE IF NOT EXISTS developer_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES developer_webhook_endpoints(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  http_status integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  CONSTRAINT developer_webhook_deliveries_status_check CHECK (status IN ('pending', 'delivered', 'failed'))
);

CREATE INDEX IF NOT EXISTS ix_developer_webhook_deliveries_endpoint_created
  ON developer_webhook_deliveries(endpoint_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_developer_webhook_deliveries_user_created
  ON developer_webhook_deliveries(user_id, created_at DESC);
