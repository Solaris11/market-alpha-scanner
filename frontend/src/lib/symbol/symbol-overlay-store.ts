"use client";

import { useSyncExternalStore } from "react";
import type { SymbolCardSourceContext } from "./symbol-intelligence-card";
import { cleanSymbolForCard } from "./symbol-intelligence-card";

export type SymbolOverlayState = {
  historyPushed: boolean;
  openedAt: number;
  open: boolean;
  scrollY: number;
  sourceContext: SymbolCardSourceContext | null;
  symbol: string | null;
  trigger: HTMLElement | null;
};

type OpenOptions = {
  sourceContext?: SymbolCardSourceContext | null;
  trigger?: HTMLElement | null;
};

type CloseOptions = {
  skipHistoryBack?: boolean;
};

const CLOSED_STATE: SymbolOverlayState = {
  historyPushed: false,
  openedAt: 0,
  open: false,
  scrollY: 0,
  sourceContext: null,
  symbol: null,
  trigger: null,
};

const listeners = new Set<() => void>();
let state: SymbolOverlayState = CLOSED_STATE;
let installed = false;
let suppressNextPopState = false;

export function getSymbolOverlayState(): SymbolOverlayState {
  return state;
}

export function subscribeSymbolOverlay(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSymbolOverlayState(): SymbolOverlayState {
  return useSyncExternalStore(subscribeSymbolOverlay, getSymbolOverlayState, getSymbolOverlayState);
}

export function useSymbolCardActions(): {
  closeSymbolCard: () => void;
  openSymbolCard: (symbol: string, sourceContext?: SymbolCardSourceContext | null, trigger?: HTMLElement | null) => void;
  replaceSymbolCard: (symbol: string, sourceContext?: SymbolCardSourceContext | null) => void;
} {
  return {
    closeSymbolCard: () => closeSymbolCard(),
    openSymbolCard: (symbol: string, sourceContext?: SymbolCardSourceContext | null, trigger?: HTMLElement | null) => openSymbolCard(symbol, { sourceContext, trigger }),
    replaceSymbolCard: (symbol: string, sourceContext?: SymbolCardSourceContext | null) => replaceSymbolCard(symbol, sourceContext),
  };
}

export function openSymbolCard(symbol: string, options: OpenOptions = {}): void {
  const cleaned = cleanSymbolForCard(symbol);
  if (!cleaned) return;
  installGlobalSymbolOverlayListeners();
  const trigger = options.trigger ?? activeTriggerElement();
  const scrollY = typeof window === "undefined" ? 0 : window.scrollY;
  const shouldPushHistory = typeof window !== "undefined" && !state.open;
  if (shouldPushHistory) {
    window.history.pushState({ ...(historyStateRecord(window.history.state) ?? {}), tradevetoSymbolCard: true, tradevetoSymbol: cleaned }, "", window.location.href);
  }
  state = {
    historyPushed: state.open ? state.historyPushed : shouldPushHistory,
    openedAt: state.open ? state.openedAt : Date.now(),
    open: true,
    scrollY,
    sourceContext: sanitizeSourceContext(options.sourceContext, cleaned),
    symbol: cleaned,
    trigger,
  };
  emitSymbolOverlayChange();
}

export function replaceSymbolCard(symbol: string, sourceContext?: SymbolCardSourceContext | null): void {
  const cleaned = cleanSymbolForCard(symbol);
  if (!cleaned) return;
  if (!state.open) {
    openSymbolCard(cleaned, { sourceContext });
    return;
  }
  state = {
    ...state,
    sourceContext: sanitizeSourceContext(sourceContext, cleaned),
    symbol: cleaned,
  };
  emitSymbolOverlayChange();
}

export function closeSymbolCard(options: CloseOptions = {}): void {
  if (!state.open) return;
  const previous = state;
  state = CLOSED_STATE;
  emitSymbolOverlayChange();

  if (typeof window !== "undefined") {
    const restoreScrollAndFocus = (): void => {
      if (previous.scrollY >= 0) window.scrollTo({ behavior: "auto", top: previous.scrollY });
      previous.trigger?.focus({ preventScroll: true });
    };
    if (!options.skipHistoryBack && previous.historyPushed && currentHistoryStateIsSymbolCard()) {
      const previousScrollRestoration = window.history.scrollRestoration;
      suppressNextPopState = true;
      window.history.scrollRestoration = "manual";
      window.history.back();
      window.setTimeout(() => {
        restoreScrollAndFocus();
        window.history.scrollRestoration = previousScrollRestoration;
      }, 80);
      window.setTimeout(restoreScrollAndFocus, 200);
    } else {
      window.requestAnimationFrame(restoreScrollAndFocus);
    }
  }
}

export function installGlobalSymbolOverlayListeners(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener("click", handleGlobalClick, true);
  window.addEventListener("popstate", () => {
    if (suppressNextPopState) {
      suppressNextPopState = false;
      return;
    }
    if (state.open) closeSymbolCard({ skipHistoryBack: true });
  });
}

function handleGlobalClick(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = event.target instanceof Element ? event.target : null;
  const anchor = target?.closest<HTMLAnchorElement>("a[href]");
  if (!anchor) return;
  if (anchor.target && anchor.target !== "_self") return;
  if (anchor.hasAttribute("download")) return;
  if (anchor.closest("[data-symbol-card-ignore='true'], [data-symbol-navigation='page']")) return;
  const symbol = symbolFromHref(anchor.href);
  if (!symbol) return;
  event.preventDefault();
  openSymbolCard(symbol, {
    sourceContext: {
      href: anchor.getAttribute("href") ?? `/symbol/${encodeURIComponent(symbol)}`,
      source: anchor.getAttribute("data-symbol-source") ?? "global-symbol-link",
      symbol,
    },
    trigger: anchor,
  });
}

function symbolFromHref(href: string): string | null {
  if (typeof window === "undefined") return null;
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  if (url.hash) return null;
  const match = url.pathname.match(/^\/symbol\/([^/]+)$/);
  if (!match?.[1]) return null;
  return cleanSymbolForCard(decodeURIComponent(match[1]));
}

function sanitizeSourceContext(sourceContext: SymbolCardSourceContext | null | undefined, symbol: string): SymbolCardSourceContext | null {
  if (!sourceContext) return null;
  return {
    ...sourceContext,
    symbol: cleanSymbolForCard(sourceContext.symbol ?? symbol) || symbol,
  };
}

function activeTriggerElement(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

function emitSymbolOverlayChange(): void {
  for (const listener of listeners) listener();
}

function historyStateRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function currentHistoryStateIsSymbolCard(): boolean {
  if (typeof window === "undefined") return false;
  return historyStateRecord(window.history.state)?.tradevetoSymbolCard === true;
}
