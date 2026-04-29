import type { BrokerExecutionAdapter } from "./BrokerExecutionAdapter";
import type { AlpacaOrderPayload, BrokerOrderResult, BrokerValidationResult, ExecutionMode } from "@/lib/trading/order-types";
import { mockSubmitOrder, validateOrderPayload } from "@/lib/trading/order-builder";

export class MockAlpacaBrokerAdapter implements BrokerExecutionAdapter {
  validateOrder(order: AlpacaOrderPayload): BrokerValidationResult {
    return validateOrderPayload(order);
  }

  submitOrder(order: AlpacaOrderPayload, mode: ExecutionMode): Promise<BrokerOrderResult> {
    return mockSubmitOrder(order, mode);
  }
}
