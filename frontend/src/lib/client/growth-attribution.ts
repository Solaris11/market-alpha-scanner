"use client";

import {
  buildTradeVetoShareUrl,
  normalizeAssetType,
  normalizeReferralCode,
  normalizeSharePlatform,
  type ShareableIntelligenceAsset,
  type ViralSharePlatform,
} from "@/lib/growth/viral-growth";

export type StoredGrowthAttribution = {
  assetType: string | null;
  capturedAt: string;
  referralCode: string | null;
  shareId: string | null;
  utmCampaign: string | null;
  utmMedium: string | null;
  utmSource: string | null;
};

const REFERRAL_CODE_KEY = "tv_growth_referral_code";
const SHARE_ID_KEY = "tv_growth_share_id";
const ATTRIBUTION_KEY = "tv_growth_attribution";
const OWN_REFERRAL_CODE_KEY = "tv_growth_own_referral_code";
const ATTRIBUTION_OPEN_EMITTED_KEY = "tv_growth_open_emitted";

export function captureGrowthAttributionFromLocation(location: Location): StoredGrowthAttribution | null {
  const params = new URLSearchParams(location.search);
  const referralCode = normalizeReferralCode(params.get("tv_ref") ?? params.get("ref"));
  const shareId = normalizeReferralCode(params.get("tv_share"));
  const assetType = params.get("tv_asset") ? normalizeAssetType(params.get("tv_asset")) : null;
  const utmSource = compactTrackingValue(params.get("utm_source"));
  const utmMedium = compactTrackingValue(params.get("utm_medium"));
  const utmCampaign = compactTrackingValue(params.get("utm_campaign"));
  if (!referralCode && !shareId && !utmSource && !utmMedium && !utmCampaign && !assetType) return readStoredGrowthAttribution();

  const attribution: StoredGrowthAttribution = {
    assetType,
    capturedAt: new Date().toISOString(),
    referralCode,
    shareId,
    utmCampaign,
    utmMedium,
    utmSource,
  };
  writeStorage(ATTRIBUTION_KEY, JSON.stringify(attribution));
  if (referralCode) writeStorage(REFERRAL_CODE_KEY, referralCode);
  if (shareId) writeStorage(SHARE_ID_KEY, shareId);
  return attribution;
}

export function readStoredGrowthAttribution(): StoredGrowthAttribution | null {
  const raw = readStorage(ATTRIBUTION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredGrowthAttribution>;
    return {
      assetType: compactTrackingValue(parsed.assetType),
      capturedAt: compactTrackingValue(parsed.capturedAt) ?? new Date().toISOString(),
      referralCode: normalizeReferralCode(parsed.referralCode),
      shareId: normalizeReferralCode(parsed.shareId),
      utmCampaign: compactTrackingValue(parsed.utmCampaign),
      utmMedium: compactTrackingValue(parsed.utmMedium),
      utmSource: compactTrackingValue(parsed.utmSource),
    };
  } catch {
    return null;
  }
}

export function readInboundReferralCode(): string | null {
  return normalizeReferralCode(readStorage(REFERRAL_CODE_KEY));
}

export function readInboundShareId(): string | null {
  return normalizeReferralCode(readStorage(SHARE_ID_KEY));
}

export function ownReferralCode(): string {
  const existing = normalizeReferralCode(readStorage(OWN_REFERRAL_CODE_KEY));
  if (existing) return existing;
  const generated = `tv_${randomSlug()}`;
  writeStorage(OWN_REFERRAL_CODE_KEY, generated);
  return generated;
}

export function buildClientShareUrl(asset: ShareableIntelligenceAsset, platform: ViralSharePlatform = "copy"): string {
  const baseUrl = typeof window === "undefined" ? "https://tradeveto.com" : window.location.origin;
  return buildTradeVetoShareUrl({
    asset,
    baseUrl,
    platform,
    referralCode: ownReferralCode(),
    shareId: `share_${randomSlug(10)}`,
  });
}

export function growthOpenStorageKey(input: { pathname: string; referralCode: string | null; shareId: string | null }): string {
  return `${ATTRIBUTION_OPEN_EMITTED_KEY}:${input.pathname}:${input.referralCode ?? "none"}:${input.shareId ?? "none"}`;
}

export function hasEmittedGrowthOpen(key: string): boolean {
  return readSessionStorage(key) === "true";
}

export function markGrowthOpenEmitted(key: string): void {
  writeSessionStorage(key, "true");
}

export function growthAttributionMetadata(attribution: StoredGrowthAttribution | null): Record<string, string | null> {
  return {
    referralCode: attribution?.referralCode ?? readInboundReferralCode(),
    shareId: attribution?.shareId ?? readInboundShareId(),
    tvAsset: attribution?.assetType ?? null,
    utmCampaign: attribution?.utmCampaign ?? null,
    utmMedium: attribution?.utmMedium ?? null,
    utmSource: attribution?.utmSource ?? null,
  };
}

export function compactTrackingValue(value: unknown): string | null {
  const text = String(value ?? "").trim().replace(/[^A-Za-z0-9_.:-]/g, "_").replace(/_+/g, "_").slice(0, 80);
  return text || null;
}

export function growthSharePlatform(value: unknown): ViralSharePlatform {
  return normalizeSharePlatform(value);
}

function randomSlug(length = 12): string {
  try {
    const bytes = new Uint8Array(Math.ceil(length * 0.75) + 2);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes)).replace(/[^A-Za-z0-9]/g, "").slice(0, length) || String(Date.now());
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, length);
  }
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Growth attribution must never block product usage.
  }
}

function readSessionStorage(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionStorage(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Session dedupe is best effort only.
  }
}
