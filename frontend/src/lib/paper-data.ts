import "server-only";

import { Pool, type QueryResultRow } from "pg";

type PoolGlobal = typeof globalThis & {
  __marketAlphaPaperPool?: Pool;
};

export type PaperAccountSummary = {
  id: string;
  name: string;
  cash_balance: number;
  equity_value: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_pnl: number;
  open_positions_count: number;
  total_account_value: number;
};

export type PaperPositionRow = {
  id: string;
  symbol: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  entry_price: number;
  exit_price: number | null;
  current_price: number | null;
  quantity: number;
  stop_loss: number | null;
  target_price: number | null;
  unrealized_pnl: number | null;
  final_decision: string | null;
  recommendation_quality: string | null;
  entry_status: string | null;
  setup_type: string | null;
  rating: string | null;
  realized_pnl: number | null;
  return_pct: number | null;
  close_reason: string | null;
};

export type PaperTradeEventRow = {
  id: string;
  symbol: string;
  event_type: string;
  event_reason: string | null;
  price: number | null;
  quantity: number | null;
  cash_delta: number | null;
  pnl_delta: number | null;
  created_at: string;
};

export type PaperData = {
  configured: boolean;
  account: PaperAccountSummary | null;
  positions: PaperPositionRow[];
  events: PaperTradeEventRow[];
  error?: string;
};

function pool() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return null;

  const globalPool = globalThis as PoolGlobal;
  if (!globalPool.__marketAlphaPaperPool) {
    globalPool.__marketAlphaPaperPool = new Pool({ connectionString: databaseUrl });
  }
  return globalPool.__marketAlphaPaperPool;
}

function numberValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textValue(value: unknown): string {
  return String(value ?? "");
}

function nullableText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function accountFromRow(row: QueryResultRow): PaperAccountSummary {
  return {
    id: textValue(row.id),
    name: textValue(row.name),
    cash_balance: numberValue(row.cash_balance),
    equity_value: numberValue(row.equity_value),
    realized_pnl: numberValue(row.realized_pnl),
    unrealized_pnl: numberValue(row.unrealized_pnl),
    total_pnl: numberValue(row.total_pnl),
    open_positions_count: numberValue(row.open_positions_count),
    total_account_value: numberValue(row.total_account_value),
  };
}

function positionFromRow(row: QueryResultRow): PaperPositionRow {
  return {
    id: textValue(row.id),
    symbol: textValue(row.symbol),
    status: textValue(row.status),
    opened_at: textValue(row.opened_at),
    closed_at: nullableText(row.closed_at),
    entry_price: numberValue(row.entry_price),
    exit_price: nullableNumber(row.exit_price),
    current_price: nullableNumber(row.current_price),
    quantity: numberValue(row.quantity),
    stop_loss: nullableNumber(row.stop_loss),
    target_price: nullableNumber(row.target_price),
    unrealized_pnl: nullableNumber(row.unrealized_pnl),
    final_decision: nullableText(row.final_decision),
    recommendation_quality: nullableText(row.recommendation_quality),
    entry_status: nullableText(row.entry_status),
    setup_type: nullableText(row.setup_type),
    rating: nullableText(row.rating),
    realized_pnl: nullableNumber(row.realized_pnl),
    return_pct: nullableNumber(row.return_pct),
    close_reason: nullableText(row.close_reason),
  };
}

function eventFromRow(row: QueryResultRow): PaperTradeEventRow {
  return {
    id: textValue(row.id),
    symbol: textValue(row.symbol),
    event_type: textValue(row.event_type),
    event_reason: nullableText(row.event_reason),
    price: nullableNumber(row.price),
    quantity: nullableNumber(row.quantity),
    cash_delta: nullableNumber(row.cash_delta),
    pnl_delta: nullableNumber(row.pnl_delta),
    created_at: textValue(row.created_at),
  };
}

export async function getPaperData(): Promise<PaperData> {
  const clientPool = pool();
  if (!clientPool) {
    return {
      configured: false,
      account: null,
      positions: [],
      events: [],
      error: "DATABASE_URL is not configured.",
    };
  }

  try {
    const [accountResult, positionsResult, eventsResult] = await Promise.all([
      clientPool.query(`
        WITH position_summary AS (
          SELECT
            account_id,
            count(*) FILTER (WHERE status = 'OPEN') AS open_positions_count,
            COALESCE(sum(unrealized_pnl) FILTER (WHERE status = 'OPEN'), 0) AS unrealized_pnl
          FROM paper_positions
          GROUP BY account_id
        )
        SELECT
          a.id::text,
          a.name,
          a.cash_balance,
          a.equity_value,
          a.realized_pnl,
          COALESCE(ps.unrealized_pnl, 0) AS unrealized_pnl,
          a.realized_pnl + COALESCE(ps.unrealized_pnl, 0) AS total_pnl,
          COALESCE(ps.open_positions_count, 0) AS open_positions_count,
          a.cash_balance + a.equity_value AS total_account_value
        FROM paper_accounts a
        LEFT JOIN position_summary ps ON ps.account_id = a.id
        WHERE a.name = 'default'
        LIMIT 1
      `),
      clientPool.query(`
        WITH latest_run AS (
          SELECT id
          FROM scan_runs
          ORDER BY completed_at DESC NULLS LAST, created_at DESC
          LIMIT 1
        ),
        latest_prices AS (
          SELECT symbol, price
          FROM scanner_signals
          WHERE scan_run_id = (SELECT id FROM latest_run)
        ),
        default_account AS (
          SELECT id
          FROM paper_accounts
          WHERE name = 'default'
          LIMIT 1
        )
        SELECT
          p.id::text,
          p.symbol,
          p.status,
          p.opened_at::text,
          p.closed_at::text,
          p.entry_price,
          p.exit_price,
          CASE
            WHEN p.status = 'OPEN' THEN lp.price
            ELSE p.exit_price
          END AS current_price,
          p.quantity,
          p.stop_loss,
          p.target_price,
          p.unrealized_pnl,
          p.final_decision,
          p.recommendation_quality,
          p.entry_status,
          p.setup_type,
          p.rating,
          p.realized_pnl,
          p.return_pct,
          p.close_reason
        FROM paper_positions p
        LEFT JOIN latest_prices lp ON lp.symbol = p.symbol
        WHERE p.account_id = (SELECT id FROM default_account)
        ORDER BY CASE WHEN p.status = 'OPEN' THEN 0 ELSE 1 END, COALESCE(p.closed_at, p.opened_at) DESC
        LIMIT 100
      `),
      clientPool.query(`
        WITH default_account AS (
          SELECT id
          FROM paper_accounts
          WHERE name = 'default'
          LIMIT 1
        )
        SELECT
          id::text,
          symbol,
          event_type,
          event_reason,
          price,
          quantity,
          cash_delta,
          pnl_delta,
          created_at::text
        FROM paper_trade_events
        WHERE account_id = (SELECT id FROM default_account)
        ORDER BY created_at DESC
        LIMIT 100
      `),
    ]);

    return {
      configured: true,
      account: accountResult.rows[0] ? accountFromRow(accountResult.rows[0]) : null,
      positions: positionsResult.rows.map(positionFromRow),
      events: eventsResult.rows.map(eventFromRow),
    };
  } catch (error) {
    return {
      configured: true,
      account: null,
      positions: [],
      events: [],
      error: error instanceof Error ? error.message : "Failed to load paper trading data.",
    };
  }
}

export async function getPaperAccount() {
  return (await getPaperData()).account;
}

export async function getPaperPositions() {
  return (await getPaperData()).positions;
}

export async function getPaperEvents() {
  return (await getPaperData()).events;
}
