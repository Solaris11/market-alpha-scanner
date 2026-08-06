export type SymbolCardReturnState = {
  createdAt: number;
  destination: string;
  returnPath: string;
};

export const SYMBOL_CARD_RETURN_KEY = "tradeveto_symbol_card_return_v1";

const RETURN_TTL_MS = 30 * 60 * 1000;

export function rememberSymbolCardReturn(destination: string): void {
  if (typeof window === "undefined") return;
  const returnPath = currentAppPath();
  const safeDestination = normalizeAppPath(destination);
  if (!returnPath || !safeDestination) return;
  const payload: SymbolCardReturnState = {
    createdAt: Date.now(),
    destination: safeDestination,
    returnPath,
  };
  try {
    window.sessionStorage.setItem(SYMBOL_CARD_RETURN_KEY, JSON.stringify(payload));
  } catch {
    // Session storage can be unavailable in hardened browsers; navigation still works.
  }
}

export function readSymbolCardReturn(): SymbolCardReturnState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SYMBOL_CARD_RETURN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SymbolCardReturnState>;
    const createdAt = typeof parsed.createdAt === "number" && Number.isFinite(parsed.createdAt) ? parsed.createdAt : 0;
    const destination = normalizeAppPath(parsed.destination ?? "");
    const returnPath = normalizeAppPath(parsed.returnPath ?? "");
    if (!createdAt || !destination || !returnPath || Date.now() - createdAt > RETURN_TTL_MS) {
      clearSymbolCardReturn();
      return null;
    }
    return { createdAt, destination, returnPath };
  } catch {
    clearSymbolCardReturn();
    return null;
  }
}

export function clearSymbolCardReturn(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SYMBOL_CARD_RETURN_KEY);
  } catch {
    // Nothing useful to do when session storage is blocked.
  }
}

export function currentAppPath(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function normalizeAppPath(value: string): string | null {
  const candidate = String(value ?? "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return null;
  if (/[\u0000-\u001f\u007f]/.test(candidate)) return null;
  try {
    const url = new URL(candidate, "https://tradeveto.local");
    if (url.origin !== "https://tradeveto.local") return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
