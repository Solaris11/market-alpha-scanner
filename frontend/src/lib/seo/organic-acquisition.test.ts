import assert from "node:assert/strict";
import test from "node:test";
import {
  SEO_SEARCH_LANDING_PAGES,
  assertSearchLandingPageIsTrustSafe,
  calculateOrganicAcquisitionMetrics,
  getSearchLandingPage,
  normalizeSeoSlug,
  searchLandingCanonical,
  searchLandingJsonLd,
} from "./organic-acquisition";

test("search landing registry covers required SEO themes", () => {
  const slugs = SEO_SEARCH_LANDING_PAGES.map((page) => page.slug);
  assert.ok(slugs.includes("amd-forecast"));
  assert.ok(slugs.includes("nvda-analysis"));
  assert.ok(slugs.includes("best-ai-stocks"));
  assert.ok(slugs.includes("market-opportunities"));
  assert.ok(slugs.includes("earnings-analysis"));
  assert.ok(slugs.includes("sector-intelligence"));
});

test("search landing pages stay research-safe", () => {
  for (const page of SEO_SEARCH_LANDING_PAGES) {
    assert.equal(assertSearchLandingPageIsTrustSafe(page), true, page.slug);
  }
});

test("search landing metadata helpers normalize and render canonical JSON-LD", () => {
  const page = getSearchLandingPage(" AMD forecast!! ");
  assert.equal(normalizeSeoSlug(" AMD forecast!! "), "amd-forecast");
  assert.equal(page?.slug, "amd-forecast");
  assert.equal(page ? searchLandingCanonical(page) : "", "https://tradeveto.com/search/amd-forecast");
  const jsonLd = page ? searchLandingJsonLd(page) : [];
  assert.equal(jsonLd.length, 2);
  assert.equal(jsonLd[0]?.["@type"], "Article");
  assert.equal(jsonLd[1]?.["@type"], "BreadcrumbList");
});

test("organic acquisition metrics do not inflate empty samples", () => {
  assert.deepEqual(calculateOrganicAcquisitionMetrics({
    organicPaidConversions: 0,
    organicSearchVisits: 0,
    organicSessions: 0,
    organicSignups: 0,
    searchLandingVisits: 0,
  }), {
    organicPaidConversionRatePct: null,
    organicPaidConversions: 0,
    organicSearchVisits: 0,
    organicSessions: 0,
    organicSignupRatePct: null,
    organicSignups: 0,
    searchLandingVisits: 0,
  });
  assert.equal(calculateOrganicAcquisitionMetrics({
    organicPaidConversions: 1,
    organicSearchVisits: 10,
    organicSessions: 5,
    organicSignups: 2,
    searchLandingVisits: 8,
  }).organicSignupRatePct, 20);
});
