export type ContinuityWorkflowGroup =
  | "account"
  | "alerts"
  | "dashboard"
  | "feed"
  | "macro"
  | "mobile"
  | "paper"
  | "performance"
  | "replay"
  | "scanner"
  | "strategy"
  | "support"
  | "symbol"
  | "terminal";

export type EcosystemRouteMemory = {
  group: ContinuityWorkflowGroup;
  path: string;
  symbol: string | null;
  visitedAt: string;
};

export type EcosystemContinuityStorageState = {
  recentRoutes: EcosystemRouteMemory[];
  recentSymbols: string[];
  restoredAt: string | null;
  updatedAt: string | null;
  version: 1;
};

export type RecordContinuityRouteInput = {
  group: ContinuityWorkflowGroup | null;
  path: string | null | undefined;
  symbol?: string | null;
  visitedAt?: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const ECOSYSTEM_CONTINUITY_STORAGE_KEY = "tradeveto.ecosystem.continuity.v1";

const GROUPS = new Set<ContinuityWorkflowGroup>([
  "account",
  "alerts",
  "dashboard",
  "feed",
  "macro",
  "mobile",
  "paper",
  "performance",
  "replay",
  "scanner",
  "strategy",
  "support",
  "symbol",
  "terminal",
]);

const DEFAULT_STATE: EcosystemContinuityStorageState = {
  recentRoutes: [],
  recentSymbols: [],
  restoredAt: null,
  updatedAt: null,
  version: 1,
};

export function defaultEcosystemContinuityStorageState(): EcosystemContinuityStorageState {
  return { ...DEFAULT_STATE, recentRoutes: [], recentSymbols: [] };
}

export function sanitizeEcosystemContinuityStorageState(value: unknown): EcosystemContinuityStorageState {
  if (!isRecord(value)) return defaultEcosystemContinuityStorageState();
  const recentRoutes = sanitizeRoutes(value.recentRoutes).slice(0, 12);
  const routeSymbols = recentRoutes.map((route) => route.symbol).filter((symbol): symbol is string => Boolean(symbol));
  return {
    recentRoutes,
    recentSymbols: sanitizeSymbols([...(Array.isArray(value.recentSymbols) ? value.recentSymbols : []), ...routeSymbols], 16),
    restoredAt: validDate(value.restoredAt),
    updatedAt: validDate(value.updatedAt),
    version: 1,
  };
}

export function readEcosystemContinuityStorage(storage: StorageLike | null | undefined): EcosystemContinuityStorageState {
  if (!storage) return defaultEcosystemContinuityStorageState();
  try {
    const raw = storage.getItem(ECOSYSTEM_CONTINUITY_STORAGE_KEY);
    if (!raw) return defaultEcosystemContinuityStorageState();
    return sanitizeEcosystemContinuityStorageState(JSON.parse(raw));
  } catch {
    return defaultEcosystemContinuityStorageState();
  }
}

export function writeEcosystemContinuityStorage(
  storage: StorageLike | null | undefined,
  state: EcosystemContinuityStorageState,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(ECOSYSTEM_CONTINUITY_STORAGE_KEY, JSON.stringify(sanitizeEcosystemContinuityStorageState(state)));
    return true;
  } catch {
    return false;
  }
}

export function recordEcosystemContinuityRoute(
  storage: StorageLike | null | undefined,
  input: RecordContinuityRouteInput,
): EcosystemContinuityStorageState {
  const current = readEcosystemContinuityStorage(storage);
  const group = input.group && GROUPS.has(input.group) ? input.group : null;
  const path = sanitizePath(input.path);
  if (!group || !path) return current;

  const symbol = sanitizeSymbol(input.symbol ?? symbolFromPath(path));
  const visitedAt = validDate(input.visitedAt) ?? new Date().toISOString();
  const route: EcosystemRouteMemory = { group, path, symbol, visitedAt };
  const recentRoutes = dedupeRoutes([route, ...current.recentRoutes]).slice(0, 12);
  const recentSymbols = sanitizeSymbols([symbol, ...current.recentSymbols], 16);
  const next: EcosystemContinuityStorageState = {
    recentRoutes,
    recentSymbols,
    restoredAt: current.restoredAt,
    updatedAt: visitedAt,
    version: 1,
  };
  writeEcosystemContinuityStorage(storage, next);
  return next;
}

export function markEcosystemContinuityRestored(storage: StorageLike | null | undefined, restoredAt = new Date().toISOString()): EcosystemContinuityStorageState {
  const current = readEcosystemContinuityStorage(storage);
  const next = sanitizeEcosystemContinuityStorageState({
    ...current,
    restoredAt,
    updatedAt: restoredAt,
  });
  writeEcosystemContinuityStorage(storage, next);
  return next;
}

function sanitizeRoutes(value: unknown): EcosystemRouteMemory[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizeRoute(item))
    .filter((item): item is EcosystemRouteMemory => Boolean(item));
}

function sanitizeRoute(value: unknown): EcosystemRouteMemory | null {
  if (!isRecord(value)) return null;
  const group = typeof value.group === "string" && GROUPS.has(value.group as ContinuityWorkflowGroup) ? value.group as ContinuityWorkflowGroup : null;
  const path = sanitizePath(value.path);
  const visitedAt = validDate(value.visitedAt);
  if (!group || !path || !visitedAt) return null;
  return {
    group,
    path,
    symbol: sanitizeSymbol(value.symbol ?? symbolFromPath(path)),
    visitedAt,
  };
}

function dedupeRoutes(routes: EcosystemRouteMemory[]): EcosystemRouteMemory[] {
  const seen = new Set<string>();
  const output: EcosystemRouteMemory[] = [];
  for (const route of routes) {
    const key = `${route.group}:${route.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(route);
  }
  return output;
}

function sanitizeSymbols(values: unknown[], limit: number): string[] {
  const output: string[] = [];
  for (const value of values) {
    const symbol = sanitizeSymbol(value);
    if (!symbol || output.includes(symbol)) continue;
    output.push(symbol);
    if (output.length >= limit) break;
  }
  return output;
}

function sanitizeSymbol(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const symbol = value.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 16);
  return symbol || null;
}

function sanitizePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  return trimmed.slice(0, 160);
}

function symbolFromPath(path: string): string | null {
  const match = path.match(/^\/symbol\/([^/?#]+)/);
  return match ? sanitizeSymbol(decodeURIComponent(match[1] ?? "")) : null;
}

function validDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
