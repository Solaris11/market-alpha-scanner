export type VisualTone = "amber" | "cyan" | "emerald" | "rose" | "slate" | "violet";

export type SymbolVisualIdentity = {
  accent: string;
  accentSoft: string;
  category: string;
  domain?: string;
  glyph: string;
  name: string;
  tone: VisualTone;
};

const SYMBOL_DOMAINS: Record<string, string> = {
  AAPL: "apple.com",
  ABNB: "airbnb.com",
  AMD: "amd.com",
  AMAT: "amat.com",
  AMZN: "amazon.com",
  APP: "applovin.com",
  ASML: "asml.com",
  AVGO: "broadcom.com",
  BAC: "bankofamerica.com",
  COIN: "coinbase.com",
  CRWD: "crowdstrike.com",
  DDOG: "datadoghq.com",
  GOOGL: "abc.xyz",
  HAL: "halliburton.com",
  IBM: "ibm.com",
  IBIT: "blackrock.com",
  META: "meta.com",
  MSFT: "microsoft.com",
  MSTR: "strategy.com",
  MU: "micron.com",
  NFLX: "netflix.com",
  NVDA: "nvidia.com",
  OXY: "oxy.com",
  PLTR: "palantir.com",
  QQQ: "invesco.com",
  SPY: "ssga.com",
  TSLA: "tesla.com",
  TSM: "tsmc.com",
  USO: "uscfinvestments.com",
  WMT: "walmart.com",
};

const SYMBOL_TONES: Record<string, VisualTone> = {
  BTC: "amber",
  GLD: "amber",
  IBIT: "amber",
  OXY: "rose",
  QQQ: "violet",
  SPY: "cyan",
  USO: "rose",
};

const TONE_HEX: Record<VisualTone, { accent: string; soft: string }> = {
  amber: { accent: "#fbbf24", soft: "rgba(251, 191, 36, 0.16)" },
  cyan: { accent: "#22d3ee", soft: "rgba(34, 211, 238, 0.16)" },
  emerald: { accent: "#34d399", soft: "rgba(52, 211, 153, 0.16)" },
  rose: { accent: "#fb7185", soft: "rgba(251, 113, 133, 0.16)" },
  slate: { accent: "#94a3b8", soft: "rgba(148, 163, 184, 0.14)" },
  violet: { accent: "#a78bfa", soft: "rgba(167, 139, 250, 0.16)" },
};

const SECTOR_TONES: Array<[RegExp, VisualTone]> = [
  [/semiconductor|technology|software|ai|internet|communication/i, "cyan"],
  [/financial|bank|payment/i, "emerald"],
  [/energy|oil|gas|commodity|materials/i, "rose"],
  [/consumer|retail|travel/i, "violet"],
  [/gold|bitcoin|crypto|treasury|bond/i, "amber"],
];

export function symbolLogoUrl(symbol: string): string | null {
  const normalized = normalizeSymbol(symbol);
  const domain = SYMBOL_DOMAINS[normalized];
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

export function symbolLogoAssetUrl(symbol: string): string | null {
  const normalized = normalizeSymbol(symbol);
  if (!SYMBOL_DOMAINS[normalized]) return null;
  return `/api/visual/symbol-logo?symbol=${encodeURIComponent(normalized)}`;
}

export function getSymbolVisualIdentity(symbol: string, sector?: string | null, companyName?: string | null): SymbolVisualIdentity {
  const normalized = normalizeSymbol(symbol);
  const domain = SYMBOL_DOMAINS[normalized];
  const tone = SYMBOL_TONES[normalized] ?? sectorTone(sector) ?? "cyan";
  const colors = TONE_HEX[tone];
  return {
    accent: colors.accent,
    accentSoft: colors.soft,
    category: categoryForSymbol(normalized, sector),
    domain,
    glyph: normalized === "BTC" ? "B" : normalized.slice(0, 2) || "?",
    name: cleanLabel(companyName) || cleanLabel(sector) || normalized,
    tone,
  };
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9.]/g, "");
}

function cleanLabel(value?: string | null): string {
  return String(value ?? "").trim();
}

function sectorTone(sector?: string | null): VisualTone | null {
  const text = cleanLabel(sector);
  if (!text) return null;
  return SECTOR_TONES.find(([pattern]) => pattern.test(text))?.[1] ?? "slate";
}

function categoryForSymbol(symbol: string, sector?: string | null): string {
  if (symbol === "BTC" || symbol === "IBIT") return "Crypto";
  if (symbol === "SPY" || symbol === "QQQ") return "ETF";
  if (symbol === "GLD" || symbol === "USO") return "Commodity";
  return cleanLabel(sector) || "Equity";
}
