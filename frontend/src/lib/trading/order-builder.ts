import type { AlpacaOrderPayload, BrokerOrderResult, BrokerValidationResult, ExecutionMode, OrderSide, OrderType, TimeInForce } from "./order-types";

type OrderInput = {
  symbol: string;
  qty: string | number;
  side: OrderSide;
  type: OrderType;
  timeInForce: TimeInForce;
  limitPrice?: string | number | null;
  stopPrice?: string | number | null;
};

function priceText(value: string | number | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed.toFixed(2) : undefined;
}

export function generateAlpacaOrderPayload(input: OrderInput): AlpacaOrderPayload {
  const payload: AlpacaOrderPayload = {
    symbol: input.symbol.trim().toUpperCase(),
    qty: String(input.qty),
    side: input.side,
    type: input.type,
    time_in_force: input.timeInForce,
  };
  const limitPrice = priceText(input.limitPrice);
  const stopPrice = priceText(input.stopPrice);
  if ((input.type === "limit" || input.type === "stop_limit") && limitPrice) payload.limit_price = limitPrice;
  if ((input.type === "stop" || input.type === "stop_limit") && stopPrice) payload.stop_price = stopPrice;
  return payload;
}

export function validateOrderPayload(order: AlpacaOrderPayload): BrokerValidationResult {
  const errors: string[] = [];
  if (!order.symbol) errors.push("Symbol is required.");
  if (!Number.isFinite(Number(order.qty)) || Number(order.qty) <= 0) errors.push("Quantity must be greater than zero.");
  if ((order.type === "limit" || order.type === "stop_limit") && !order.limit_price) errors.push("Limit price is required.");
  if ((order.type === "stop" || order.type === "stop_limit") && !order.stop_price) errors.push("Stop price is required.");
  return { valid: errors.length === 0, errors };
}

export async function mockSubmitOrder(order: AlpacaOrderPayload, mode: ExecutionMode): Promise<BrokerOrderResult> {
  const validation = validateOrderPayload(order);
  if (!validation.valid) {
    return {
      ok: false,
      orderId: "mock-rejected",
      submittedAt: new Date().toISOString(),
      mode,
      payload: order,
      message: validation.errors.join(" "),
    };
  }
  return {
    ok: true,
    orderId: `mock_${Date.now().toString(36)}`,
    submittedAt: new Date().toISOString(),
    mode,
    payload: order,
    message: "Mock execution only. No real order was placed.",
  };
}
