import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Metadata } from "next";
import { CANONICAL_URL } from "@/lib/brand";
import { marketingMetadata, openGraphImageUrl } from "./marketing-seo";

type OpenGraphImage = {
  alt?: string;
  height?: number;
  type?: string;
  url?: string | URL;
  width?: number;
};

function metadataFor(path: string): Metadata {
  return marketingMetadata(path, {
    title: `Test ${path}`,
    description: `Description for ${path}`,
  });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

describe("marketing SEO metadata", () => {
  it("uses an absolute PNG image for OpenGraph and Twitter previews", () => {
    const metadata = metadataFor("/");
    const image = Array.isArray(metadata.openGraph?.images) ? metadata.openGraph.images[0] as OpenGraphImage : null;

    assert.equal(openGraphImageUrl, `${CANONICAL_URL}/og-image.png`);
    assert.equal(image?.url, openGraphImageUrl);
    assert.equal(image?.width, 1200);
    assert.equal(image?.height, 630);
    assert.equal(image?.type, "image/png");
    assert.deepEqual(metadata.twitter?.images, [openGraphImageUrl]);
  });

  it("sets required social fields for marketing routes without legacy naming", () => {
    for (const path of ["/", "/pricing", "/features", "/how-it-works", "/faq"]) {
      const metadata = metadataFor(path);
      const payload = JSON.stringify(metadata);
      const openGraph = record(metadata.openGraph);
      const twitter = record(metadata.twitter);

      assert.equal(openGraph.type, "website");
      assert.equal(openGraph.url, new URL(path, CANONICAL_URL).toString());
      assert.equal(openGraph.siteName, "TradeVeto");
      assert.equal(twitter.card, "summary_large_image");
      assert.match(payload, /TradeVeto/);
      assert.doesNotMatch(payload, /Market Alpha|marketalpha/i);
    }
  });
});
