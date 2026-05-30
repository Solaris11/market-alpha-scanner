export const VIRAL_SHARE_PLATFORMS = ["x", "facebook", "linkedin", "reddit", "discord", "telegram", "copy"] as const;
export const VIRAL_ASSET_TYPES = ["ai_insight", "macro_intelligence", "market_opportunity", "performance_summary", "symbol_page", "watchlist_snapshot"] as const;

export type ViralSharePlatform = (typeof VIRAL_SHARE_PLATFORMS)[number];
export type ViralAssetType = (typeof VIRAL_ASSET_TYPES)[number];

export type ShareableIntelligenceAsset = {
  assetType: ViralAssetType;
  description: string;
  path: string;
  symbol?: string | null;
  title: string;
};

export type ViralGrowthCounts = {
  activeUsers: number;
  inviteOpenedUsers: number;
  inviteSent: number;
  organicGrowthVisits: number;
  paidConversions: number;
  referralSignups: number;
  shareAssetOpened: number;
  shareClicks: number;
};

export type ViralGrowthMetrics = {
  referralConversionPct: number | null;
  shareConversionPct: number | null;
  viralCoefficient: number | null;
};

const SAFE_REFERRAL_CODE_PATTERN = /[^A-Za-z0-9_-]/g;
const PLATFORM_LABELS: Record<ViralSharePlatform, string> = {
  copy: "Copy link",
  discord: "Discord",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  reddit: "Reddit",
  telegram: "Telegram",
  x: "X",
};

export function normalizeReferralCode(value: unknown): string | null {
  const code = String(value ?? "").trim().replace(SAFE_REFERRAL_CODE_PATTERN, "").slice(0, 64);
  return code || null;
}

export function normalizeAssetType(value: unknown): ViralAssetType {
  const normalized = String(value ?? "").trim();
  return VIRAL_ASSET_TYPES.includes(normalized as ViralAssetType) ? (normalized as ViralAssetType) : "ai_insight";
}

export function normalizeSharePlatform(value: unknown): ViralSharePlatform {
  const normalized = String(value ?? "").trim().toLowerCase();
  return VIRAL_SHARE_PLATFORMS.includes(normalized as ViralSharePlatform) ? (normalized as ViralSharePlatform) : "copy";
}

export function sharePlatformLabel(platform: ViralSharePlatform): string {
  return PLATFORM_LABELS[platform];
}

export function buildTradeVetoShareUrl(input: {
  asset: ShareableIntelligenceAsset;
  baseUrl?: string;
  referralCode?: string | null;
  shareId?: string | null;
  platform?: ViralSharePlatform;
}): string {
  const baseUrl = input.baseUrl?.trim() || "https://tradeveto.com";
  const url = new URL(safeAssetPath(input.asset.path), baseUrl);
  const referralCode = normalizeReferralCode(input.referralCode);
  const shareId = normalizeReferralCode(input.shareId);
  const platform = normalizeSharePlatform(input.platform);
  url.searchParams.set("utm_source", platform);
  url.searchParams.set("utm_medium", "share");
  url.searchParams.set("utm_campaign", "viral_growth");
  url.searchParams.set("tv_asset", input.asset.assetType);
  if (referralCode) url.searchParams.set("tv_ref", referralCode);
  if (shareId) url.searchParams.set("tv_share", shareId);
  if (input.asset.symbol) url.searchParams.set("symbol", input.asset.symbol.toUpperCase());
  return url.toString();
}

export function buildSocialDistributionUrl(input: {
  asset: ShareableIntelligenceAsset;
  platform: ViralSharePlatform;
  shareUrl: string;
}): string | null {
  const platform = normalizeSharePlatform(input.platform);
  const url = encodeURIComponent(input.shareUrl);
  const title = encodeURIComponent(`${input.asset.title} | TradeVeto`);
  const description = encodeURIComponent(input.asset.description);

  if (platform === "x") return `https://twitter.com/intent/tweet?url=${url}&text=${title}`;
  if (platform === "facebook") return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
  if (platform === "linkedin") return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
  if (platform === "reddit") return `https://www.reddit.com/submit?url=${url}&title=${title}`;
  if (platform === "telegram") return `https://t.me/share/url?url=${url}&text=${title}`;
  if (platform === "discord") return null;
  if (platform === "copy") return null;
  return null;
}

export function calculateViralGrowthMetrics(counts: ViralGrowthCounts): ViralGrowthMetrics {
  return {
    referralConversionPct: percentOrNull(counts.referralSignups, counts.inviteOpenedUsers),
    shareConversionPct: percentOrNull(counts.shareAssetOpened, counts.shareClicks),
    viralCoefficient: counts.activeUsers > 0 ? round(counts.referralSignups / counts.activeUsers, 4) : null,
  };
}

export function growthAssetSummary(asset: ShareableIntelligenceAsset): string {
  const symbol = asset.symbol ? ` ${asset.symbol.toUpperCase()}` : "";
  if (asset.assetType === "symbol_page") return `Share${symbol} symbol intelligence`;
  if (asset.assetType === "market_opportunity") return "Share market opportunities";
  if (asset.assetType === "macro_intelligence") return "Share macro intelligence";
  if (asset.assetType === "performance_summary") return "Share performance summary";
  if (asset.assetType === "watchlist_snapshot") return "Share watchlist snapshot";
  return "Share AI insight";
}

function safeAssetPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function percentOrNull(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return round((numerator / denominator) * 100, 2);
}

function round(value: number, digits: number): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}
