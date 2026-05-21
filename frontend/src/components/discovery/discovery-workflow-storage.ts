import type { DiscoverySymbol } from "@/lib/trading/intelligence-discovery";

export type DiscoveryResultDensity = "cards" | "dense" | "speed";

export type DiscoveryWorkflowState = {
  compareSymbols: string[];
  density: DiscoveryResultDensity;
  shortlistSymbols: string[];
  updatedAt: string | null;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const DISCOVERY_WORKFLOW_STORAGE_KEY = "tradeveto.discovery.workflow.v1";
const DEFAULT_WORKFLOW_STATE: DiscoveryWorkflowState = {
  compareSymbols: [],
  density: "speed",
  shortlistSymbols: [],
  updatedAt: null,
};

const DENSITIES = new Set<DiscoveryResultDensity>(["cards", "dense", "speed"]);

export function sanitizeDiscoverySymbols(values: unknown, validSymbols?: Set<string>, limit = 12): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const symbol = sanitizeSymbol(value);
    if (!symbol || seen.has(symbol)) continue;
    if (validSymbols && !validSymbols.has(symbol)) continue;
    seen.add(symbol);
    result.push(symbol);
    if (result.length >= limit) break;
  }

  return result;
}

export function sanitizeDiscoveryWorkflowState(value: unknown, symbols: DiscoverySymbol[] = []): DiscoveryWorkflowState {
  if (!isRecord(value)) return DEFAULT_WORKFLOW_STATE;
  const validSymbols = symbols.length ? new Set(symbols.map((symbol) => symbol.symbol)) : undefined;
  const density = typeof value.density === "string" && DENSITIES.has(value.density as DiscoveryResultDensity) ? value.density as DiscoveryResultDensity : DEFAULT_WORKFLOW_STATE.density;
  const updatedAt = typeof value.updatedAt === "string" && Number.isFinite(Date.parse(value.updatedAt)) ? value.updatedAt : null;

  return {
    compareSymbols: sanitizeDiscoverySymbols(value.compareSymbols, validSymbols, 4),
    density,
    shortlistSymbols: sanitizeDiscoverySymbols(value.shortlistSymbols, validSymbols, 20),
    updatedAt,
  };
}

export function loadDiscoveryWorkflowState(storage: StorageLike | null | undefined, symbols: DiscoverySymbol[] = []): DiscoveryWorkflowState {
  if (!storage) return DEFAULT_WORKFLOW_STATE;
  try {
    const raw = storage.getItem(DISCOVERY_WORKFLOW_STORAGE_KEY);
    if (!raw) return DEFAULT_WORKFLOW_STATE;
    return sanitizeDiscoveryWorkflowState(JSON.parse(raw), symbols);
  } catch {
    return DEFAULT_WORKFLOW_STATE;
  }
}

export function saveDiscoveryWorkflowState(storage: StorageLike | null | undefined, value: DiscoveryWorkflowState): boolean {
  if (!storage) return false;
  try {
    storage.setItem(DISCOVERY_WORKFLOW_STORAGE_KEY, JSON.stringify({ ...sanitizeDiscoveryWorkflowState(value), updatedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

function sanitizeSymbol(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const symbol = value.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "");
  return symbol.length > 0 && symbol.length <= 16 ? symbol : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
