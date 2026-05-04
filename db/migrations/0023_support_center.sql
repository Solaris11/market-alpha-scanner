CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  email text NOT NULL,
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz NULL,
  CONSTRAINT support_tickets_category_check CHECK (category IN ('billing', 'account', 'scanner', 'alerts', 'technical', 'feedback', 'other')),
  CONSTRAINT support_tickets_status_check CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  CONSTRAINT support_tickets_priority_check CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

CREATE INDEX IF NOT EXISTS ix_support_tickets_user_created_at
  ON support_tickets(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_support_tickets_status_updated_at
  ON support_tickets(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS ix_support_tickets_category_created_at
  ON support_tickets(category, created_at DESC);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type text NOT NULL,
  sender_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_ticket_messages_sender_type_check CHECK (sender_type IN ('user', 'admin', 'system'))
);

CREATE INDEX IF NOT EXISTS ix_support_ticket_messages_ticket_created_at
  ON support_ticket_messages(ticket_id, created_at ASC);

CREATE INDEX IF NOT EXISTS ix_support_ticket_messages_sender_user
  ON support_ticket_messages(sender_user_id);
