import type { AlpacaOrderPayload, BrokerOrderResult, BrokerValidationResult, ExecutionMode } from "@/lib/trading/order-types";

export interface BrokerExecutionAdapter {
  submitOrder(order: AlpacaOrderPayload, mode: ExecutionMode): Promise<BrokerOrderResult>;
  validateOrder(order: AlpacaOrderPayload): BrokerValidationResult;
}
