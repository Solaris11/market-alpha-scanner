import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildStaticSocialPreviewHtml,
  isPublicSocialPreviewPath,
  isSafeSocialCrawlerMethod,
  isSocialCrawlerUserAgent,
  shouldAllowSocialCrawlerRequest,
  shouldServeStaticSocialPreview,
} from "./social-crawlers";

describe("social crawler allowlist", () => {
  it("recognizes legitimate social preview crawlers", () => {
    for (const userAgent of [
      "facebookexternalhit/1.1",
      "Facebot",
      "meta-externalagent/1.1",
      "meta-externalfetcher/1.1",
      "Twitterbot/1.0",
      "LinkedInBot/1.0",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "Discordbot/2.0",
    ]) {
      assert.equal(isSocialCrawlerUserAgent(userAgent), true, userAgent);
    }
  });

  it("limits crawler pass-through to public preview-safe paths", () => {
    for (const pathname of [
      "/",
      "/pricing",
      "/features",
      "/how-it-works",
      "/faq",
      "/intelligence",
      "/intelligence/shock-opportunities",
      "/intelligence/macro-regime",
      "/intelligence/why-wait/AMD",
      "/symbol/TSM",
      "/robots.txt",
      "/og-image.png",
      "/pricing/",
    ]) {
      assert.equal(isPublicSocialPreviewPath(pathname), true, pathname);
    }

    for (const pathname of ["/terminal", "/opportunities", "/history", "/account", "/api/health"]) {
      assert.equal(isPublicSocialPreviewPath(pathname), false, pathname);
    }
  });

  it("allows only safe methods for social preview crawlers", () => {
    assert.equal(isSafeSocialCrawlerMethod("GET"), true);
    assert.equal(isSafeSocialCrawlerMethod("HEAD"), true);
    assert.equal(isSafeSocialCrawlerMethod("POST"), false);
    assert.equal(isSafeSocialCrawlerMethod("PUT"), false);
  });

  it("requires crawler UA, public path, and safe method together", () => {
    assert.equal(shouldAllowSocialCrawlerRequest({ method: "HEAD", pathname: "/", userAgent: "facebookexternalhit/1.1" }), true);
    assert.equal(shouldAllowSocialCrawlerRequest({ method: "GET", pathname: "/pricing", userAgent: "Facebot" }), true);
    assert.equal(shouldAllowSocialCrawlerRequest({ method: "GET", pathname: "/symbol/AMD", userAgent: "Facebot" }), true);
    assert.equal(shouldAllowSocialCrawlerRequest({ method: "GET", pathname: "/intelligence/why-wait/AMD", userAgent: "Facebot" }), true);
    assert.equal(shouldAllowSocialCrawlerRequest({ method: "GET", pathname: "/", userAgent: "meta-externalagent/1.1" }), true);
    assert.equal(shouldAllowSocialCrawlerRequest({ method: "GET", pathname: "/terminal", userAgent: "Facebot" }), false);
    assert.equal(shouldAllowSocialCrawlerRequest({ method: "GET", pathname: "/", userAgent: "Mozilla/5.0" }), false);
    assert.equal(shouldAllowSocialCrawlerRequest({ method: "POST", pathname: "/", userAgent: "Twitterbot/1.0" }), false);
  });

  it("serves static social preview HTML only for crawler-safe marketing pages", () => {
    assert.equal(shouldServeStaticSocialPreview({ method: "GET", pathname: "/", userAgent: "facebookexternalhit/1.1" }), true);
    assert.equal(shouldServeStaticSocialPreview({ method: "HEAD", pathname: "/pricing", userAgent: "meta-externalagent/1.1" }), true);
    assert.equal(shouldServeStaticSocialPreview({ method: "GET", pathname: "/intelligence", userAgent: "facebookexternalhit/1.1" }), true);
    assert.equal(shouldServeStaticSocialPreview({ method: "GET", pathname: "/symbol/AMD", userAgent: "facebookexternalhit/1.1" }), false);
    assert.equal(shouldServeStaticSocialPreview({ method: "GET", pathname: "/og-image.png", userAgent: "facebookexternalhit/1.1" }), false);
    assert.equal(shouldServeStaticSocialPreview({ method: "GET", pathname: "/terminal", userAgent: "facebookexternalhit/1.1" }), false);
    assert.equal(shouldServeStaticSocialPreview({ method: "GET", pathname: "/", userAgent: "Mozilla/5.0" }), false);
  });

  it("builds a compact absolute-url social preview document", () => {
    const html = buildStaticSocialPreviewHtml({ pathname: "/pricing?x=1" });
    assert.match(html, /<meta property="og:title" content="TradeVeto - AI Market Intelligence for Disciplined Traders">/);
    assert.match(html, /<meta property="og:description" content="TradeVeto helps traders avoid low-quality setups/);
    assert.match(html, /<meta property="og:url" content="https:\/\/tradeveto\.com\/pricing">/);
    assert.match(html, /<meta property="og:image" content="https:\/\/tradeveto\.com\/og-image\.png">/);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  });
});
