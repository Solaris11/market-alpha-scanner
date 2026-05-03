import { NextRequest, NextResponse } from "next/server";
import { safePaperErrorCode } from "@/lib/paper-safety";
import { requireUser } from "@/lib/server/access-control";
import { getDbPool } from "@/lib/server/db";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ManualPaperTradePayload = {
  entry_price?: unknown;
  quantity?: unknown;
  side?: unknown;
  stop_loss?: unknown;
  symbol?: unknown;
  target_price?: unknown;
};

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[$,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function validatePayload(payload: ManualPaperTradePayload) {
  const symbol = String(payload.symbol ?? "").trim().toUpperCase();
  const side = String(payload.side ?? "").trim().toLowerCase();
  const entryPrice = numberValue(payload.entry_price);
  const quantity = numberValue(payload.quantity);
  const stopLoss = numberValue(payload.stop_loss);
  const targetPrice = numberValue(payload.target_price);
  const errors: string[] = [];

  if (!symbol) errors.push("Symbol is required.");
  if (side !== "buy") errors.push("Only buy paper trades are supported right now.");
  if (entryPrice === null || entryPrice <= 0) errors.push("Entry price must be greater than zero.");
  if (quantity === null || quantity <= 0) errors.push("Quantity must be greater than zero.");
  if (payload.stop_loss !== undefined && payload.stop_loss !== "" && (stopLoss === null || stopLoss <= 0)) errors.push("Stop loss must be greater than zero when provided.");
  if (payload.target_price !== undefined && payload.target_price !== "" && (targetPrice === null || targetPrice <= 0)) errors.push("Target price must be greater than zero when provided.");

  return { entryPrice, errors, quantity, side, stopLoss, symbol, targetPrice };
}

export async function POST(request: NextRequest) {
  const rateLimited = rateLimitRequest(request, "paper:open", { limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireUser("Sign in to open paper trades.");
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const clientPool = getDbPool();
  if (!clientPool) {
    return NextResponse.json({ ok: false, error: safePaperErrorCode("trade") }, { status: 503 });
  }

  const payload = (await request.json().catch(() => null)) as ManualPaperTradePayload | null;
  if (!payload) {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  const validated = validatePayload(payload);
  if (validated.errors.length) {
    return NextResponse.json({ ok: false, error: validated.errors.join(" ") }, { status: 400 });
  }

  const entryPrice = validated.entryPrice!;
  const quantity = validated.quantity!;
  const positionValue = entryPrice * quantity;
  const userId = access.user.id;
  const accountName = `default:${userId}`;
  const client = await clientPool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`
      INSERT INTO paper_accounts (
        name,
        user_id,
        starting_balance,
        cash_balance,
        equity_value,
        realized_pnl,
        max_position_pct,
        risk_per_trade_pct,
        max_open_positions,
        enabled
      )
      VALUES ($1, $2, 10000, 10000, 0, 0, 0.10, 0.01, 5, true)
      ON CONFLICT (name) DO UPDATE
      SET user_id = COALESCE(paper_accounts.user_id, EXCLUDED.user_id), updated_at = now()
    `, [accountName, userId]);

    const accountResult = await client.query(
      `
        SELECT id::text, cash_balance
        FROM paper_accounts
        WHERE name = $1
        FOR UPDATE
      `,
      [accountName],
    );
    const account = accountResult.rows[0] as { cash_balance: string; id: string } | undefined;
    if (!account) throw new Error("Default paper account is unavailable.");

    const cashBalance = Number(account.cash_balance);
    if (!Number.isFinite(cashBalance) || cashBalance < positionValue) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "Insufficient paper cash balance" }, { status: 400 });
    }

    const positionResult = await client.query(
      `
        INSERT INTO paper_positions (
          account_id,
          user_id,
          symbol,
          status,
          opened_at,
          entry_price,
          quantity,
          stop_loss,
          target_price,
          final_decision,
          recommendation_quality,
          entry_status,
          setup_type,
          rating,
          realized_pnl,
          unrealized_pnl,
          return_pct,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, 'OPEN', now(), $4, $5, $6, $7, 'MANUAL', 'MANUAL', 'MANUAL', 'manual', 'MANUAL', 0, 0, 0, now(), now())
        RETURNING
          id::text,
          symbol,
          status,
          opened_at::text,
          entry_price,
          quantity,
          stop_loss,
          target_price,
          final_decision,
          recommendation_quality,
          setup_type,
          rating
      `,
      [account.id, userId, validated.symbol, entryPrice, quantity, validated.stopLoss, validated.targetPrice],
    );
    const position = positionResult.rows[0];

    const eventResult = await client.query(
      `
        INSERT INTO paper_trade_events (
          account_id,
          user_id,
          position_id,
          symbol,
          event_type,
          event_reason,
          price,
          quantity,
          cash_delta,
          pnl_delta,
          created_at
        )
        VALUES ($1, $2, $3, $4, 'OPEN', 'MANUAL_ENTRY', $5, $6, $7, 0, now())
        RETURNING
          id::text,
          symbol,
          event_type,
          event_reason,
          price,
          quantity,
          cash_delta,
          pnl_delta,
          created_at::text
      `,
      [account.id, userId, position.id, validated.symbol, entryPrice, quantity, -positionValue],
    );
    const event = eventResult.rows[0];

    await client.query(
      `
        UPDATE paper_accounts
        SET
          cash_balance = cash_balance - $2,
          equity_value = (
            SELECT COALESCE(sum(entry_price * quantity) FILTER (WHERE status = 'OPEN'), 0)
            FROM paper_positions
            WHERE account_id = $1
          ),
          updated_at = now()
        WHERE id = $1
      `,
      [account.id, positionValue],
    );

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, position, event });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("[paper] failed to open manual paper trade", error);
    return NextResponse.json({ ok: false, error: safePaperErrorCode("trade") }, { status: 500 });
  } finally {
    client.release();
  }
}
