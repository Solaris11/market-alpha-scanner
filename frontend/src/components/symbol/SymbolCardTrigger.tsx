"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { openSymbolCard } from "@/lib/symbol/symbol-overlay-store";
import type { SymbolCardSourceContext } from "@/lib/symbol/symbol-intelligence-card";

type SymbolCardTriggerProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  children: ReactNode;
  sourceContext?: SymbolCardSourceContext | null;
  symbol: string;
};

export function SymbolCardTrigger({
  children,
  sourceContext,
  symbol,
  type = "button",
  ...props
}: SymbolCardTriggerProps) {
  return (
    <button
      {...props}
      data-stable-overlay-trigger="true"
      data-symbol-card-trigger="true"
      onClick={(event) => {
        openSymbolCard(symbol, { sourceContext, trigger: event.currentTarget });
      }}
      type={type}
    >
      {children}
    </button>
  );
}
