import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSocialDistributionUrl,
  buildTradeVetoShareUrl,
  calculateViralGrowthMetrics,
  normalizeReferralCode,
  type ShareableIntelligenceAsset,
} from "./viral-growth";

const symbolAsset: ShareableIntelligenceAsset = {
  assetType: "symbol_page",
  description: "Evidence-backed AMD research context.",
  path: "/symbol/AMD",
  symbol: "AMD",
  title: "AMD symbol intelligence",
};

describe("viral growth utilities", () => {
  it("builds branded share URLs with sanitized referral attribution", () => {
    const url = new URL(buildTradeVetoShareUrl({
      asset: symbolAsset,
      baseUrl: "https://tradeveto.com",
      platform: "x",
      referralCode: "abc-123<script>",
      shareId: "share_1",
    }));

    assert.equal(url.origin, "https://tradeveto.com");
    assert.equal(url.pathname, "/symbol/AMD");
    assert.equal(url.searchParams.get("tv_ref"), "abc-123script");
    assert.equal(url.searchParams.get("tv_share"), "share_1");
    assert.equal(url.searchParams.get("tv_asset"), "symbol_page");
    assert.equal(url.searchParams.get("utm_source"), "x");
    assert.equal(url.searchParams.get("utm_medium"), "share");
    assert.equal(url.searchParams.get("symbol"), "AMD");
  });

  it("keeps social distribution URLs platform-specific without secrets", () => {
    const shareUrl = buildTradeVetoShareUrl({ asset: symbolAsset, referralCode: "ref_1", shareId: "share_1" });
    assert.match(buildSocialDistributionUrl({ asset: symbolAsset, platform: "x", shareUrl }) ?? "", /^https:\/\/twitter\.com\/intent\/tweet/);
    assert.match(buildSocialDistributionUrl({ asset: symbolAsset, platform: "linkedin", shareUrl }) ?? "", /^https:\/\/www\.linkedin\.com\/sharing\/share-offsite/);
    assert.equal(buildSocialDistributionUrl({ asset: symbolAsset, platform: "copy", shareUrl }), null);
    assert.equal(buildSocialDistributionUrl({ asset: symbolAsset, platform: "discord", shareUrl }), null);
    assert.doesNotMatch(shareUrl, /email|token|secret|password/i);
  });

  it("normalizes referral codes and calculates bounded viral metrics", () => {
    assert.equal(normalizeReferralCode(" ref<script>_42 "), "refscript_42");
    assert.deepEqual(calculateViralGrowthMetrics({
      activeUsers: 10,
      inviteOpenedUsers: 4,
      inviteSent: 8,
      organicGrowthVisits: 5,
      paidConversions: 1,
      referralSignups: 2,
      shareAssetOpened: 6,
      shareClicks: 12,
    }), {
      referralConversionPct: 50,
      shareConversionPct: 50,
      viralCoefficient: 0.2,
    });
  });
});
