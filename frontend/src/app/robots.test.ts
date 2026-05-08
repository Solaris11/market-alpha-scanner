import assert from "node:assert/strict";
import { describe, it } from "node:test";
import robots from "./robots";

type RobotsRule = {
  allow?: string | string[];
  disallow?: string | string[];
  userAgent?: string | string[];
};

function rules(): RobotsRule[] {
  const payload = robots();
  return Array.isArray(payload.rules) ? payload.rules as RobotsRule[] : [payload.rules as RobotsRule];
}

describe("robots social crawler access", () => {
  it("explicitly allows social preview crawlers on public marketing pages", () => {
    const socialRule = rules().find((rule) => Array.isArray(rule.userAgent) && rule.userAgent.includes("facebookexternalhit"));
    assert.ok(socialRule);
    assert.ok(Array.isArray(socialRule.userAgent));
    assert.equal(socialRule.userAgent.includes("meta-externalagent"), true);
    assert.equal(socialRule.userAgent.includes("meta-externalfetcher"), true);
    assert.deepEqual(socialRule.allow, ["/", "/pricing", "/features", "/how-it-works", "/faq", "/og-image.png"]);
    assert.ok(Array.isArray(socialRule.disallow));
    assert.equal(socialRule.disallow.includes("/api/"), true);
    assert.equal(socialRule.disallow.includes("/terminal"), true);
  });

  it("keeps default crawler access open for public pages and closed for private surfaces", () => {
    const defaultRule = rules().find((rule) => rule.userAgent === "*");
    assert.ok(defaultRule);
    assert.equal(defaultRule.allow, "/");
    assert.ok(Array.isArray(defaultRule.disallow));
    assert.equal(defaultRule.disallow.includes("/account"), true);
    assert.equal(defaultRule.disallow.includes("/symbol/"), true);
  });
});
