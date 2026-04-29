export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop" | "stop_limit";
export type TimeInForce = "day" | "gtc";
export type ExecutionMode = "paper" | "live";

export type AlpacaOrderPayload = {
  symbol: string;
  qty: string;
  side: OrderSide;
  type: OrderType;
  time_in_force: TimeInForce;
  limit_price?: string;
  stop_price?: string;
};

export type BrokerValidationResult = {
  valid: boolean;
  errors: string[];
};

export type BrokerOrderResult = {
  ok: boolean;
  orderId: string;
  submittedAt: string;
  mode: ExecutionMode;
  payload: AlpacaOrderPayload;
  message: string;
};
