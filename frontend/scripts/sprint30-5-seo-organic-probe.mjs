#!/usr/bin/env node

import { createHmac, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import pg from "pg";

const { Pool } = pg;

const baseUrl = stripTrailingSlash(process.env.TRADEVETO_SPRINT30_SEO_BASE_URL ?? "https://tradeveto.com");
const artifactRoot = process.env.TRADEVETO_SPRINT30_SEO_ARTIFACT_ROOT
  ?? join(process.cwd(), "../docs/ops/artifacts/sprint-30-5-seo-organic");
const outputPath = process.env.TRADEVETO_SPRINT30_SEO_OUTPUT ?? join(artifactRoot, "seo-organic-proof.json");
const timeoutMs = positiveInteger(process.env.TRADEVETO_SPRINT30_SEO_TIMEOUT_MS, 20_000);
const startedAt = new Date().toISOString();

const publicRoutes = [
  "/",
  "/feed",
  "/macro",
  "/market-memory",
  "/intelligence",
  "/symbol/AMD",
  "/search/amd-forecast",
  "/search/nvda-analysis",
  "/search/best-ai-stocks",
  "/search/market-opportunities",
  "/search/earnings-analysis",
  "/search/sector-intelligence",
];

const requiredSearchRoutes = publicRoutes.filter((route) => route.startsWith("/search/"));

let probeIdentity = null;
let cookie = process.env.TRADEVETO_SPRINT30_SEO_COOKIE ?? "";
let exitCode = 0;

async function main() {
  try {
    if (!cookie && process.env.TRADEVETO_SPRINT30_SEO_CREATE_PROBE_ADMIN !== "false") {
      probeIdentity = await createProductionProbeAdmin();
      cookie = `market_alpha_session=${probeIdentity.sessionToken}`;
    }

    const [robots, sitemap, routeAudits, analyticsProof] = await Promise.all([
      requestText("/robots.txt", "text/plain"),
      requestText("/sitemap.xml", "application/xml"),
      Promise.all(publicRoutes.map((route) => auditRoute(route))),
      cookie ? readAnalyticsProof() : Promise.resolve({ blockers: ["admin analytics cookie unavailable"], organicAcquisition: null, statusCode: 0 }),
    ]);
    const sitemapUrls = Array.from(sitemap.bodyText.matchAll(/<loc>(.*?)<\/loc>/g)).map((match) => match[1] ?? "");
    const blockers = [
      ...robotsBlockers(robots),
      ...sitemapBlockers(sitemap, sitemapUrls),
      ...routeAudits.flatMap((audit) => audit.blockers.map((blocker) => `${audit.route}: ${blocker}`)),
      ...analyticsProof.blockers,
    ];
    const report = {
      analyticsProof,
      baseUrl,
      blockers,
      coreWebVitals: {
        measuredBy: "seo_core_web_vital client event via useReportWebVitals",
        productionSamples: analyticsProof.organicAcquisition?.pagePerformance ?? [],
      },
      finalVerdict: blockers.length ? "TRADEVETO SEO + ORGANIC ACQUISITION ENGINE NOT ACCOMPLISHED" : "TRADEVETO SEO + ORGANIC ACQUISITION ENGINE STRONG PARTIAL ACCOMPLISHED",
      generatedAt: new Date().toISOString(),
      indexationReport: {
        requiredSearchRoutes,
        sitemapRouteCount: sitemapUrls.length,
        sitemapSearchRoutesPresent: requiredSearchRoutes.every((route) => sitemapUrls.includes(`${baseUrl}${route}`)),
        sitemapSymbolAmdPresent: sitemapUrls.includes(`${baseUrl}/symbol/AMD`),
      },
      noSyntheticOrganicEventsCreated: true,
      organicGrowthProofBoundary: "The probe verifies technical SEO, indexation plumbing, search landing pages, and analytics dashboards. It does not fabricate organic sessions, Search Console rankings, signups, or paid conversions.",
      overallStatus: blockers.length ? "not_ready" : "strong_partial",
      publicRouteAudits: routeAudits,
      robots: {
        allowsSearch: /Allow:\s*\/search\//i.test(robots.bodyText) || !/Disallow:\s*\/search\//i.test(robots.bodyText),
        hasSitemap: robots.bodyText.includes(`${baseUrl}/sitemap.xml`),
        statusCode: robots.statusCode,
      },
      sitemap: {
        requiredSearchRoutes,
        statusCode: sitemap.statusCode,
        urlCount: sitemapUrls.length,
      },
      startedAt,
      successCriteria: {
        indexedPageGrowth: "instrumented via sitemap and future indexation reports",
        organicPaidConversionGrowth: "instrumented via organic_paid_conversion from Stripe webhook metadata",
        organicSignupGrowth: "instrumented via organic_signup events",
        organicTrafficGrowth: "instrumented via organic_search_visit and search_landing_open events",
        searchImpressionGrowth: "requires external Search Console export or ranking observer events",
      },
    };
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    console.log(serialized);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, serialized, "utf8");
    if (report.overallStatus === "not_ready") exitCode = 1;
  } catch (error) {
    exitCode = 1;
    const failure = {
      baseUrl,
      error: error instanceof Error ? error.message : "Sprint 30.5 SEO organic proof failed",
      generatedAt: new Date().toISOString(),
      noSyntheticOrganicEventsCreated: true,
      overallStatus: "not_ready",
      startedAt,
    };
    await mkdir(dirname(outputPath), { recursive: true }).catch(() => undefined);
    await writeFile(outputPath, `${JSON.stringify(failure, null, 2)}\n`, "utf8").catch(() => undefined);
    console.error(JSON.stringify(failure, null, 2));
  } finally {
    if (probeIdentity && process.env.TRADEVETO_SPRINT30_SEO_CLEANUP_PROBE_ADMIN !== "false") {
      await cleanupProductionProbeAdmin(probeIdentity).catch((error) => {
        console.warn("[sprint30-seo] probe admin cleanup failed", error instanceof Error ? error.message : error);
        exitCode = exitCode || 1;
      });
    }
    process.exitCode = exitCode;
  }
}

async function auditRoute(route) {
  const response = await requestText(route, "text/html");
  const html = response.bodyText;
  const blockers = [];
  if (response.statusCode !== 200) blockers.push(`HTTP ${response.statusCode}`);
  if (!/<title[^>]*>[^<]{8,}<\/title>/i.test(html)) blockers.push("missing title");
  if (!/<meta[^>]+name=["']description["'][^>]+content=["'][^"']{40,}/i.test(html)) blockers.push("missing meta description");
  if (!/<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']+/i.test(html)) blockers.push("missing canonical URL");
  if (!/<meta[^>]+property=["']og:title["'][^>]+content=/i.test(html)) blockers.push("missing Open Graph title");
  if (!/<script[^>]+type=["']application\/ld\+json["']/i.test(html)) blockers.push("missing structured data");
  if (/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html)) blockers.push("page is noindex");
  return {
    blockers,
    bytes: html.length,
    hasCanonical: /<link[^>]+rel=["']canonical["']/i.test(html),
    hasDescription: /<meta[^>]+name=["']description["']/i.test(html),
    hasOpenGraph: /<meta[^>]+property=["']og:title["']/i.test(html),
    hasStructuredData: /<script[^>]+type=["']application\/ld\+json["']/i.test(html),
    route,
    statusCode: response.statusCode,
  };
}

async function readAnalyticsProof() {
  const response = await requestText("/api/admin/analytics?range=30d", "application/json", {
    Cookie: cookie,
    "X-TradeVeto-Probe": "sprint30-seo-organic",
  });
  const payload = parseJson(response.bodyText);
  const analytics = payload?.analytics ?? null;
  const organicAcquisition = analytics?.organicAcquisition ?? null;
  const blockers = [];
  if (response.statusCode !== 200) blockers.push(`/api/admin/analytics returned ${response.statusCode}`);
  if (payload?.ok !== true) blockers.push("admin analytics response was not ok");
  if (!organicAcquisition) blockers.push("organicAcquisition analytics block is missing");
  return {
    blockers,
    latencyMs: response.latencyMs,
    organicAcquisition,
    statusCode: response.statusCode,
  };
}

function robotsBlockers(robots) {
  const blockers = [];
  if (robots.statusCode !== 200) blockers.push(`/robots.txt returned ${robots.statusCode}`);
  if (!robots.bodyText.includes(`${baseUrl}/sitemap.xml`)) blockers.push("robots.txt missing sitemap");
  if (/Disallow:\s*\/search\//i.test(robots.bodyText)) blockers.push("robots.txt blocks search landing pages");
  return blockers;
}

function sitemapBlockers(sitemap, sitemapUrls) {
  const blockers = [];
  if (sitemap.statusCode !== 200) blockers.push(`/sitemap.xml returned ${sitemap.statusCode}`);
  for (const route of requiredSearchRoutes) {
    if (!sitemapUrls.includes(`${baseUrl}${route}`)) blockers.push(`sitemap missing ${route}`);
  }
  if (!sitemapUrls.includes(`${baseUrl}/symbol/AMD`)) blockers.push("sitemap missing /symbol/AMD");
  return blockers;
}

async function requestText(path, accept, extraHeaders = {}) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      cache: "no-store",
      headers: {
        Accept: accept,
        "User-Agent": "TradeVeto-Sprint30SeoProbe/1.0",
        ...extraHeaders,
      },
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });
    return {
      bodyText: await response.text().catch(() => ""),
      latencyMs: Math.round(performance.now() - started),
      path,
      statusCode: response.status,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function createProductionProbeAdmin() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to create a Sprint 30.5 SEO probe admin.");
  const sessionSecret = sessionHashSecret(process.env);
  const pool = new Pool({ connectionString: databaseUrl });
  const email = `sprint30-seo-${Date.now()}-${randomBytes(4).toString("hex")}@tradeveto-probe.local`;
  const sessionToken = randomBytes(32).toString("base64url");
  const sessionTokenHash = createHmac("sha256", sessionSecret).update(sessionToken).digest("hex");
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const userResult = await client.query(
      `
        INSERT INTO users (
          email,
          display_name,
          email_verified,
          email_verified_at,
          state,
          role,
          timezone,
          risk_experience_level,
          onboarding_completed,
          created_at,
          updated_at
        )
        VALUES ($1, 'Sprint 30.5 SEO Probe', true, now(), 'active', 'admin', 'America/New_York', 'advanced', true, now(), now())
        RETURNING id::text
      `,
      [email],
    );
    const userId = userResult.rows[0]?.id;
    if (!userId) throw new Error("Failed to create Sprint 30.5 SEO probe admin.");
    await client.query(
      `
        INSERT INTO user_sessions (user_id, session_token_hash, expires_at, created_at)
        VALUES ($1::uuid, $2, now() + interval '2 hours', now())
      `,
      [userId, sessionTokenHash],
    );
    await client.query("COMMIT");
    return { email, sessionToken, userId };
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client?.release();
    await pool.end().catch(() => undefined);
  }
}

async function cleanupProductionProbeAdmin(identity) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query("DELETE FROM users WHERE id = $1::uuid AND email = $2", [identity.userId, identity.email]);
  } finally {
    await pool.end().catch(() => undefined);
  }
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sessionHashSecret(env) {
  const secret = [
    env.TRADEVETO_SESSION_SECRET,
    env.MARKET_ALPHA_SESSION_SECRET,
    env.AUTH_SECRET,
    env.NEXTAUTH_SECRET,
    env.SESSION_SECRET,
  ].find((value) => Boolean(value?.trim()))?.trim();
  if (secret) return secret;
  throw new Error("Session secret is not configured.");
}

function stripTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

await main();
