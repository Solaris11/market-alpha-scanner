import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPublicSocialPreviewPath, isSafeSocialCrawlerMethod, isSocialCrawlerUserAgent, shouldAllowSocialCrawlerRequest } from "./social-crawlers";

describe("social crawler allowlist", () => {
  it("recognizes legitimate social preview crawlers", () => {
    for (const userAgent of [
      "facebookexternalhit/1.1",
      "Facebot",
      "Twitterbot/1.0",
      "LinkedInBot/1.0",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "Discordbot/2.0",
    ]) {
      assert.equal(isSocialCrawlerUserAgent(userAgent), true, userAgent);
    }
  });

  it("limits crawler pass-through to public preview-safe paths", () => {
    for (const pathname of ["/", "/pricing", "/features", "/how-it-works", "/faq", "/og-image.png", "/pricing/"]) {
      assert.equal(isPublicSocialPreviewPath(pathname), true, pathname);
    }

    for (const pathname of ["/terminal", "/opportunities", "/history", "/account", "/api/health", "/symbol/TSM"]) {
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
    assert.equal(shouldAllowSocialCrawlerRequest({ method: "GET", pathname: "/terminal", userAgent: "Facebot" }), false);
    assert.equal(shouldAllowSocialCrawlerRequest({ method: "GET", pathname: "/", userAgent: "Mozilla/5.0" }), false);
    assert.equal(shouldAllowSocialCrawlerRequest({ method: "POST", pathname: "/", userAgent: "Twitterbot/1.0" }), false);
  });
});
