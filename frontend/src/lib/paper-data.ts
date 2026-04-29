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

export type PaperAnalyticsSummary = {
  total_trades: number;
  open_trades: number;
  closed_trades: number;
  win_rate: number;
  avg_return_pct: number;
  total_realized_pnl: number;
  total_unrealized_pnl: number;
  total_pnl: number;
  max_drawdown: number;
};

export type PaperAnalyticsGroupRow = {
  group_type: string;
  group_value: string;
  count: number;
  avg_return_pct: number;
  win_rate: number;
  total_pnl: number;
};

export type PaperAnalyticsTimelinePoint = {
  date: string;
  daily_pnl: number;
  cumulative_pnl: number;
};

export type PaperData = {
  configured: boolean;
  account: PaperAccountSummary | null;
  positions: PaperPositionRow[];
  events: PaperTradeEventRow[];
  error?: string;
};

export type PaperAnalyticsData = {
  configured: boolean;
  summary: PaperAnalyticsSummary;
  groups: PaperAnalyticsGroupRow[];
  timeline: PaperAnalyticsTimelinePoint[];
  error?: string;
};

const ZERO_ANALYTICS_SUMMARY: PaperAnalyticsSummary = {
  total_trades: 0,
  open_trades: 0,
  closed_trades: 0,
  win_rate: 0,
  avg_return_pct: 0,
  total_realized_pnl: 0,
  total_unrealized_pnl: 0,
  total_pnl: 0,
  max_drawdown: 0,
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

function timelineFromRow(row: QueryResultRow): PaperAnalyticsTimelinePoint {
  return {
    date: textValue(row.date),
    daily_pnl: numberValue(row.daily_pnl),
    cumulative_pnl: numberValue(row.cumulative_pnl),
  };
}

function maxDrawdown(timeline: PaperAnalyticsTimelinePoint[]): number {
  let peak = 0;
  let drawdown = 0;
  for (const point of timeline) {
    if (point.cumulative_pnl > peak) peak = point.cumulative_pnl;
    const currentDrawdown = point.cumulative_pnl - peak;
    if (currentDrawdown < drawdown) drawdown = currentDrawdown;
  }
  return drawdown;
}

function summaryFromRow(row: QueryResultRow | undefined, timeline: PaperAnalyticsTimelinePoint[]): PaperAnalyticsSummary {
  if (!row) return { ...ZERO_ANALYTICS_SUMMARY };
  return {
    total_trades: numberValue(row.total_trades),
    open_trades: numberValue(row.open_trades),
    closed_trades: numberValue(row.closed_trades),
    win_rate: numberValue(row.win_rate),
    avg_return_pct: numberValue(row.avg_return_pct),
    total_realized_pnl: numberValue(row.total_realized_pnl),
    total_unrealized_pnl: numberValue(row.total_unrealized_pnl),
    total_pnl: numberValue(row.total_pnl),
    max_drawdown: maxDrawdown(timeline),
  };
}

function analyticsGroupFromRow(row: QueryResultRow): PaperAnalyticsGroupRow {
  return {
    group_type: textValue(row.group_type),
    group_value: textValue(row.group_value),
    count: numberValue(row.count),
    avg_return_pct: numberValue(row.avg_return_pct),
    win_rate: numberValue(row.win_rate),
    total_pnl: numberValue(row.total_pnl),
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

export async function getPaperAnalytics(): Promise<PaperAnalyticsData> {
  const clientPool = pool();
  if (!clientPool) {
    return {
      configured: false,
      summary: { ...ZERO_ANALYTICS_SUMMARY },
      groups: [],
      timeline: [],
      error: "DATABASE_URL is not configured.",
    };
  }

  try {
    const [summaryResult, groupsResult, timelineResult] = await Promise.all([
      clientPool.query(`
        WITH default_account AS (
          SELECT id
          FROM paper_accounts
          WHERE name = 'default'
          LIMIT 1
        ),
        positions AS (
          SELECT *
          FROM paper_positions
          WHERE account_id = (SELECT id FROM default_account)
        )
        SELECT
          count(*) AS total_trades,
          count(*) FILTER (WHERE upper(status) = 'OPEN') AS open_trades,
          count(*) FILTER (WHERE upper(status) = 'CLOSED') AS closed_trades,
          COALESCE(
            (count(*) FILTER (WHERE upper(status) = 'CLOSED' AND realized_pnl > 0))::numeric
              / NULLIF(count(*) FILTER (WHERE upper(status) = 'CLOSED'), 0),
            0
          ) AS win_rate,
          COALESCE(avg(return_pct) FILTER (WHERE upper(status) = 'CLOSED'), 0) AS avg_return_pct,
          COALESCE(sum(realized_pnl) FILTER (WHERE upper(status) = 'CLOSED'), 0) AS total_realized_pnl,
          COALESCE(sum(unrealized_pnl) FILTER (WHERE upper(status) = 'OPEN'), 0) AS total_unrealized_pnl,
          COALESCE(sum(realized_pnl) FILTER (WHERE upper(status) = 'CLOSED'), 0)
            + COALESCE(sum(unrealized_pnl) FILTER (WHERE upper(status) = 'OPEN'), 0) AS total_pnl
        FROM positions
      `),
      clientPool.query(`
        WITH default_account AS (
          SELECT id
          FROM paper_accounts
          WHERE name = 'default'
          LIMIT 1
        ),
        closed_positions AS (
          SELECT *
          FROM paper_positions
          WHERE account_id = (SELECT id FROM default_account)
            AND upper(status) = 'CLOSED'
        )
        SELECT * FROM (
          SELECT 'symbol' AS group_type, COALESCE(NULLIF(symbol, ''), 'UNKNOWN') AS group_value,
            count(*) AS count, COALESCE(avg(return_pct), 0) AS avg_return_pct,
            COALESCE((count(*) FILTER (WHERE realized_pnl > 0))::numeric / NULLIF(count(*), 0), 0) AS win_rate,
            COALESCE(sum(realized_pnl), 0) AS total_pnl
          FROM closed_positions GROUP BY COALESCE(NULLIF(symbol, ''), 'UNKNOWN')
          UNION ALL
          SELECT 'setup_type' AS group_type, COALESCE(NULLIF(setup_type, ''), 'UNKNOWN') AS group_value,
            count(*) AS count, COALESCE(avg(return_pct), 0) AS avg_return_pct,
            COALESCE((count(*) FILTER (WHERE realized_pnl > 0))::numeric / NULLIF(count(*), 0), 0) AS win_rate,
            COALESCE(sum(realized_pnl), 0) AS total_pnl
          FROM closed_positions GROUP BY COALESCE(NULLIF(setup_type, ''), 'UNKNOWN')
          UNION ALL
          SELECT 'rating' AS group_type, COALESCE(NULLIF(rating, ''), 'UNKNOWN') AS group_value,
            count(*) AS count, COALESCE(avg(return_pct), 0) AS avg_return_pct,
            COALESCE((count(*) FILTER (WHERE realized_pnl > 0))::numeric / NULLIF(count(*), 0), 0) AS win_rate,
            COALESCE(sum(realized_pnl), 0) AS total_pnl
          FROM closed_positions GROUP BY COALESCE(NULLIF(rating, ''), 'UNKNOWN')
          UNION ALL
          SELECT 'recommendation_quality' AS group_type, COALESCE(NULLIF(recommendation_quality, ''), 'UNKNOWN') AS group_value,
            count(*) AS count, COALESCE(avg(return_pct), 0) AS avg_return_pct,
            COALESCE((count(*) FILTER (WHERE realized_pnl > 0))::numeric / NULLIF(count(*), 0), 0) AS win_rate,
            COALESCE(sum(realized_pnl), 0) AS total_pnl
          FROM closed_positions GROUP BY COALESCE(NULLIF(recommendation_quality, ''), 'UNKNOWN')
          UNION ALL
          SELECT 'final_decision' AS group_type, COALESCE(NULLIF(final_decision, ''), 'UNKNOWN') AS group_value,
            count(*) AS count, COALESCE(avg(return_pct), 0) AS avg_return_pct,
            COALESCE((count(*) FILTER (WHERE realized_pnl > 0))::numeric / NULLIF(count(*), 0), 0) AS win_rate,
            COALESCE(sum(realized_pnl), 0) AS total_pnl
          FROM closed_positions GROUP BY COALESCE(NULLIF(final_decision, ''), 'UNKNOWN')
        ) grouped
        ORDER BY group_type, total_pnl DESC, group_value
      `),
      clientPool.query(`
        WITH default_account AS (
          SELECT id
          FROM paper_accounts
          WHERE name = 'default'
          LIMIT 1
        ),
        daily AS (
          SELECT closed_at::date AS trade_date, COALESCE(sum(realized_pnl), 0) AS daily_pnl
          FROM paper_positions
          WHERE account_id = (SELECT id FROM default_account)
            AND upper(status) = 'CLOSED'
            AND closed_at IS NOT NULL
          GROUP BY closed_at::date
        )
        SELECT
          trade_date::text AS date,
          daily_pnl,
          sum(daily_pnl) OVER (ORDER BY trade_date) AS cumulative_pnl
        FROM daily
        ORDER BY trade_date
      `),
    ]);

    const timeline = timelineResult.rows.map(timelineFromRow);
    return {
      configured: true,
      summary: summaryFromRow(summaryResult.rows[0], timeline),
      groups: groupsResult.rows.map(analyticsGroupFromRow),
      timeline,
    };
  } catch (error) {
    return {
      configured: true,
      summary: { ...ZERO_ANALYTICS_SUMMARY },
      groups: [],
      timeline: [],
      error: error instanceof Error ? error.message : "Failed to load paper trading analytics.",
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

export async function getPaperAnalyticsSummary() {
  return (await getPaperAnalytics()).summary;
}

export async function getPaperAnalyticsGroups() {
  return (await getPaperAnalytics()).groups;
}

export async function getPaperAnalyticsTimeline() {
  return (await getPaperAnalytics()).timeline;
}
