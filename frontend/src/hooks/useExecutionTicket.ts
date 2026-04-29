"use client";

import { useEffect, useMemo, useState } from "react";
import { MockAlpacaBrokerAdapter } from "@/lib/adapters/MockAlpacaBrokerAdapter";
import { generateAlpacaOrderPayload } from "@/lib/trading/order-builder";
import type { BrokerOrderResult, ExecutionMode, OrderSide, OrderType, TimeInForce } from "@/lib/trading/order-types";

const adapter = new MockAlpacaBrokerAdapter();

export function useExecutionTicket(defaults: { symbol: string; qty: number; limitPrice?: number; stopPrice?: number }) {
  const [side, setSide] = useState<OrderSide>("buy");
  const [type, setType] = useState<OrderType>("limit");
  const [timeInForce, setTimeInForce] = useState<TimeInForce>("day");
  const [mode, setMode] = useState<ExecutionMode>("paper");
  const [qty, setQtyState] = useState(String(defaults.qty || ""));
  const [manualQtyOverride, setManualQtyOverride] = useState(false);
  const [limitPrice, setLimitPrice] = useState(defaults.limitPrice ? defaults.limitPrice.toFixed(2) : "");
  const [stopPrice, setStopPrice] = useState(defaults.stopPrice ? defaults.stopPrice.toFixed(2) : "");
  const [result, setResult] = useState<BrokerOrderResult | null>(null);

  useEffect(() => {
    if (manualQtyOverride) return;
    setQtyState(defaults.qty > 0 ? String(defaults.qty) : "");
  }, [defaults.qty, manualQtyOverride]);

  const payload = useMemo(
    () => generateAlpacaOrderPayload({ symbol: defaults.symbol, qty, side, type, timeInForce, limitPrice, stopPrice }),
    [defaults.symbol, limitPrice, qty, side, stopPrice, timeInForce, type],
  );
  const validation = useMemo(() => adapter.validateOrder(payload), [payload]);
  const submit = async () => setResult(await adapter.submitOrder(payload, mode));
  return {
    state: { side, type, timeInForce, mode, qty, limitPrice, stopPrice, manualQtyOverride },
    setters: {
      setSide,
      setType,
      setTimeInForce,
      setMode,
      setQty: (value: string) => {
        setManualQtyOverride(true);
        setQtyState(value);
      },
      setLimitPrice,
      setStopPrice,
      resyncQty: () => {
        setManualQtyOverride(false);
        setQtyState(defaults.qty > 0 ? String(defaults.qty) : "");
      },
    },
    payload,
    validation,
    result,
    submit,
    clearResult: () => setResult(null),
  };
}
