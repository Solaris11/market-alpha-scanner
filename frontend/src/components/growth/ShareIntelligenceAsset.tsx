"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, MessageCircle, Send, Share2, Users } from "lucide-react";
import {
  buildSocialDistributionUrl,
  growthAssetSummary,
  sharePlatformLabel,
  type ShareableIntelligenceAsset,
  type ViralSharePlatform,
} from "@/lib/growth/viral-growth";
import { buildClientShareUrl, ownReferralCode } from "@/lib/client/growth-attribution";
import { trackAnalyticsEvent } from "@/lib/client/analytics";

const PLATFORMS: ViralSharePlatform[] = ["x", "facebook", "linkedin", "reddit", "discord", "telegram", "copy"];

type ShareIntelligenceAssetProps = {
  asset: ShareableIntelligenceAsset;
  compact?: boolean;
  title?: string;
};

export function ShareIntelligenceAsset({ asset, compact = false, title }: ShareIntelligenceAssetProps) {
  const [copied, setCopied] = useState(false);
  const referralCode = useMemo(() => (typeof window === "undefined" ? null : ownReferralCode()), []);
  const previewUrl = useMemo(() => buildClientShareUrl(asset, "copy"), [asset]);

  useEffect(() => {
    trackAnalyticsEvent("share_asset_view", {
      assetPath: asset.path,
      assetTitle: asset.title,
      assetType: asset.assetType,
      referralCode,
      symbol: asset.symbol ?? null,
    }, { source: "viral_share", symbol: asset.symbol ?? undefined });
  }, [asset, referralCode]);

  async function handleShare(platform: ViralSharePlatform): Promise<void> {
    const shareUrl = buildClientShareUrl(asset, platform);
    const parsed = new URL(shareUrl);
    const shareId = parsed.searchParams.get("tv_share");
    const nextReferralCode = parsed.searchParams.get("tv_ref");
    const metadata = {
      assetPath: asset.path,
      assetTitle: asset.title,
      assetType: asset.assetType,
      platform,
      referralCode: nextReferralCode,
      shareId,
      symbol: asset.symbol ?? null,
    };
    trackAnalyticsEvent("invite_link_created", metadata, { source: "viral_share", symbol: asset.symbol ?? undefined });
    trackAnalyticsEvent("share_asset_click", metadata, { source: "viral_share", symbol: asset.symbol ?? undefined });

    const distributionUrl = buildSocialDistributionUrl({ asset, platform, shareUrl });
    if (platform === "copy" || platform === "discord" || !distributionUrl) {
      await copyShareUrl(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      trackAnalyticsEvent("share_asset_copy", metadata, { source: "viral_share", symbol: asset.symbol ?? undefined });
      trackAnalyticsEvent("invite_sent", { ...metadata, method: platform === "discord" ? "copy_for_discord" : "copy_link" }, { source: "viral_share", symbol: asset.symbol ?? undefined });
      return;
    }

    window.open(distributionUrl, "_blank", "noopener,noreferrer");
    trackAnalyticsEvent("invite_sent", { ...metadata, method: "social_platform" }, { source: "viral_share", symbol: asset.symbol ?? undefined });
  }

  return (
    <section className={`rounded-3xl border border-cyan-300/16 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.12),transparent_20rem),linear-gradient(135deg,rgba(2,6,23,0.86),rgba(15,23,42,0.7))] ${compact ? "p-3" : "p-4"}`} data-growth-share-asset={asset.assetType}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
            <Share2 className="h-3.5 w-3.5" />
            Viral growth asset
          </div>
          <h3 className={`${compact ? "mt-1 text-base" : "mt-2 text-xl"} font-black text-white`}>{title ?? growthAssetSummary(asset)}</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">{asset.description}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400 lg:max-w-[22rem]">
          <div className="font-mono text-[11px] text-cyan-100">{referralCode ?? "referral-ready"}</div>
          <div className="mt-1 truncate">{previewUrl}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {PLATFORMS.map((platform) => (
          <button
            aria-label={`Share ${asset.title} to ${sharePlatformLabel(platform)}`}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-slate-200 transition hover:border-cyan-300/40 hover:text-cyan-100"
            data-analytics-id={`share-${asset.assetType}-${platform}`}
            onClick={() => void handleShare(platform)}
            type="button"
            key={platform}
          >
            {iconFor(platform)}
            {sharePlatformLabel(platform)}
          </button>
        ))}
      </div>
      <div className="mt-2 min-h-5 text-xs font-semibold text-emerald-200">{copied ? "Share link copied with referral attribution." : "Shared links carry referral and source attribution without exposing private account data."}</div>
    </section>
  );
}

export function GrowthReferralPanel({ compact = false }: { compact?: boolean }) {
  const asset = useMemo<ShareableIntelligenceAsset>(() => ({
    assetType: "ai_insight",
    description: "Invite another trader into TradeVeto with a branded early-access link. Attribution records opens, signup from referral, and checkout-start conversion without storing secrets in the URL.",
    path: "/register",
    title: "TradeVeto founding member invite",
  }), []);

  return <ShareIntelligenceAsset asset={asset} compact={compact} title="Invite traders into TradeVeto" />;
}

async function copyShareUrl(url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = url;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function iconFor(platform: ViralSharePlatform) {
  if (platform === "copy") return <Copy className="h-4 w-4" />;
  if (platform === "telegram") return <Send className="h-4 w-4" />;
  if (platform === "discord" || platform === "reddit") return <MessageCircle className="h-4 w-4" />;
  if (platform === "facebook" || platform === "linkedin") return <Users className="h-4 w-4" />;
  return <Share2 className="h-4 w-4" />;
}
