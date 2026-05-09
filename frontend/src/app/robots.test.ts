import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRobotsTxt, GET, HEAD } from "./robots.txt/route";

function linesForUserAgent(body: string, userAgent: string): string[] {
  const blocks = body.split(/\n\n+/);
  return blocks.find((block) => block.includes(`User-Agent: ${userAgent}`))?.split("\n") ?? [];
}

describe("robots social crawler access", () => {
  it("explicitly allows social preview crawlers on public marketing pages", () => {
    const socialLines = linesForUserAgent(buildRobotsTxt(), "facebookexternalhit");
    assert.equal(socialLines.includes("User-Agent: meta-externalagent"), true);
    assert.equal(socialLines.includes("User-Agent: meta-externalfetcher"), true);
    assert.equal(socialLines.includes("Allow: /"), true);
    assert.equal(socialLines.includes("Allow: /intelligence"), true);
    assert.equal(socialLines.includes("Allow: /symbol/"), true);
    assert.equal(socialLines.includes("Allow: /robots.txt"), true);
    assert.equal(socialLines.includes("Allow: /og-image.png"), true);
    assert.equal(socialLines.includes("Disallow: /api/"), true);
    assert.equal(socialLines.includes("Disallow: /terminal"), true);
  });

  it("keeps default crawler access open for public pages and closed for private surfaces", () => {
    const defaultLines = linesForUserAgent(buildRobotsTxt(), "*");
    assert.equal(defaultLines.includes("Allow: /"), true);
    assert.equal(defaultLines.includes("Disallow: /account"), true);
    assert.equal(defaultLines.includes("Disallow: /symbol/"), false);
  });

  it("serves robots with a short cache horizon for social debugger recovery", () => {
    const response = GET();
    assert.equal(response.headers.get("Cache-Control"), "public, max-age=60, must-revalidate");
    assert.equal(response.headers.get("Content-Type"), "text/plain; charset=utf-8");
  });

  it("supports HEAD checks without a body", async () => {
    const response = HEAD();
    assert.equal(response.headers.get("Cache-Control"), "public, max-age=60, must-revalidate");
    assert.equal(await response.text(), "");
  });
});
