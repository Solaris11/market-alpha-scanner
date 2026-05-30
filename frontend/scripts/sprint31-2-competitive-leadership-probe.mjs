#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";

const baseUrl = stripTrailingSlash(process.env.TRADEVETO_SPRINT31_COMPETITIVE_BASE_URL ?? "https://tradeveto.com");
const artifactRoot = process.env.TRADEVETO_SPRINT31_COMPETITIVE_ARTIFACT_ROOT
  ?? join(process.cwd(), "../docs/ops/artifacts/sprint-31-2-competitive-leadership");
const outputPath = process.env.TRADEVETO_SPRINT31_COMPETITIVE_OUTPUT ?? join(artifactRoot, "competitive-leadership-proof.json");
const timeoutMs = positiveInteger(process.env.TRADEVETO_SPRINT31_COMPETITIVE_TIMEOUT_MS, 20_000);
const sourceTimeoutMs = positiveInteger(process.env.TRADEVETO_SPRINT31_COMPETITIVE_SOURCE_TIMEOUT_MS, 8_000);
const startedAt = new Date().toISOString();

const REQUIRED_COUNTS = { ai: 1, intelligence: 3, workflow: 2 };
const REQUIRED_ROUTES = [
  { accept: "application/json", key: "competitive_api", path: "/api/intelligence/competitive-leadership" },
  { accept: "text/html", key: "terminal", path: "/terminal" },
  { accept: "text/html", key: "discover", path: "/discover" },
  { accept: "text/html", key: "scanner", path: "/scanner" },
  { accept: "text/html", key: "macro", path: "/macro" },
  { accept: "text/html", key: "symbol_amd", path: "/symbol/AMD" },
];

let exitCode = 0;

async function main() {
  try {
    const routeResults = [];
    for (const route of REQUIRED_ROUTES) {
      routeResults.push(await requestText(route.path, route.accept, route.key));
    }
    const modelResponse = routeResults.find((route) => route.key === "competitive_api");
    const modelPayload = parseJson(modelResponse?.bodyText ?? "");
    const model = modelPayload?.model ?? null;
    const sourceReachability = model?.sources ? await fetchSourceReachability(model.sources) : [];
    const blockers = [
      ...routeBlockers(routeResults),
      ...modelBlockers(model),
    ];
    const report = {
      baseUrl,
      benchmarkSourceReachability: sourceReachability,
      blockers,
      finalVerdict: blockers.length ? "TRADEVETO CATEGORY LEADER STATUS NOT ACHIEVED" : "TRADEVETO CATEGORY LEADER STATUS ACHIEVED",
      generatedAt: new Date().toISOString(),
      modelSummary: model ? {
        benchmarkValidation: model.benchmarkValidation,
        capabilities: model.capabilities?.length ?? 0,
        criticalGapCount: model.criticalGapCount,
        finalVerdict: model.finalVerdict,
        leadershipCounts: model.leadershipCounts,
        materialGapCount: model.materialGaps?.length ?? 0,
        matrixRows: model.matrix?.length ?? 0,
        noUnsupportedParityClaims: model.noUnsupportedParityClaims,
        overallStatus: model.overallStatus,
        platforms: model.platforms?.length ?? 0,
        sourceCount: model.sources?.length ?? 0,
      } : null,
      overallStatus: blockers.length ? "not_ready" : "ready",
      proofBoundary: "This probe verifies the production competitive-leadership API, public workflow route availability, source-backed matrix coverage, category-leadership target counts, documented gap closure plans, and no unsupported parity claims. Public competitor source reachability is recorded as evidence context and is not treated as a parity claim.",
      routeResults: routeResults.map(({ bodyText, ...route }) => ({ ...route, bytes: bodyText.length })),
      startedAt,
    };

    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    console.log(serialized);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, serialized, "utf8");
    if (report.overallStatus !== "ready") exitCode = 1;
  } catch (error) {
    exitCode = 1;
    const failure = {
      baseUrl,
      error: error instanceof Error ? error.message : "Sprint 31.2 competitive leadership proof failed",
      generatedAt: new Date().toISOString(),
      overallStatus: "not_ready",
      startedAt,
    };
    await mkdir(dirname(outputPath), { recursive: true }).catch(() => undefined);
    await writeFile(outputPath, `${JSON.stringify(failure, null, 2)}\n`, "utf8").catch(() => undefined);
    console.error(JSON.stringify(failure, null, 2));
  } finally {
    process.exitCode = exitCode;
  }
}

function routeBlockers(routes) {
  const blockers = [];
  for (const route of routes) {
    if (route.statusCode !== 200) blockers.push(`${route.path} returned ${route.statusCode}`);
    if (route.key === "competitive_api" && !/CATEGORY LEADER STATUS/i.test(route.bodyText)) blockers.push("competitive leadership API missing verdict copy");
    if (route.key === "terminal" && !/copilot|TradeVeto/i.test(route.bodyText)) blockers.push("/terminal missing copilot or TradeVeto copy");
    if (route.key === "discover" && !/discover|scanner|opportunit/i.test(route.bodyText)) blockers.push("/discover missing discovery copy");
    if (route.key === "scanner" && !/scanner|TradeVeto/i.test(route.bodyText)) blockers.push("/scanner missing scanner copy");
  }
  return blockers;
}

function modelBlockers(model) {
  const blockers = [];
  if (!model) return ["competitive leadership model missing"];
  if (model.overallStatus !== "achieved") blockers.push(`overallStatus ${model.overallStatus}`);
  if (model.finalVerdict !== "TRADEVETO CATEGORY LEADER STATUS ACHIEVED") blockers.push(`finalVerdict ${model.finalVerdict}`);
  if (model.criticalGapCount !== 0) blockers.push(`criticalGapCount ${model.criticalGapCount}`);
  if (model.noUnsupportedParityClaims !== true) blockers.push("unsupported parity claim guard failed");
  if ((model.platforms?.length ?? 0) < 8) blockers.push("missing benchmark platform coverage");
  if ((model.capabilities?.length ?? 0) < 11) blockers.push("missing capability coverage");
  const expectedRows = (model.platforms?.length ?? 0) * (model.capabilities?.length ?? 0);
  if ((model.matrix?.length ?? 0) < expectedRows) blockers.push("competitive matrix incomplete");
  for (const [key, required] of Object.entries(REQUIRED_COUNTS)) {
    if ((model.leadershipCounts?.[key] ?? 0) < required) blockers.push(`${key} leadership count below ${required}`);
  }
  const benchmark = model.benchmarkValidation ?? {};
  if ((benchmark.depthScore ?? 0) < 85) blockers.push("benchmark depth score below target");
  if ((benchmark.signalQualityScore ?? 0) < 90) blockers.push("signal quality score below target");
  if ((benchmark.researchEfficiencyScore ?? 0) < 88) blockers.push("research efficiency score below target");
  if ((benchmark.userWorkflowCompletionScore ?? 0) < 88) blockers.push("workflow completion score below target");
  const badGap = (model.materialGaps ?? []).find((gap) => !gap.closurePlan || !gap.verification || gap.severity === "critical");
  if (badGap) blockers.push(`gap documentation incomplete for ${badGap.platform}:${badGap.capability}`);
  if (JSON.stringify(model).match(/guaranteed|full TradingView parity|best in every category|broker execution/i)) blockers.push("model contains unsupported parity or execution claim");
  return blockers;
}

async function fetchSourceReachability(sources) {
  const unique = [...new Map(sources.map((source) => [source.url, source])).values()];
  const results = [];
  for (const source of unique) {
    results.push(await fetchSource(source));
  }
  return results;
}

async function fetchSource(source) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), sourceTimeoutMs);
  try {
    const response = await fetch(source.url, {
      headers: { "User-Agent": "TradeVeto-Sprint31CompetitiveProbe/1.0" },
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });
    await response.arrayBuffer().catch(() => new ArrayBuffer(0));
    return {
      label: source.label,
      latencyMs: Math.round(performance.now() - started),
      ok: response.ok,
      platform: source.platform,
      statusCode: response.status,
      url: source.url,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "source fetch failed",
      label: source.label,
      latencyMs: Math.round(performance.now() - started),
      ok: false,
      platform: source.platform,
      statusCode: 0,
      url: source.url,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function requestText(path, accept, key) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      cache: "no-store",
      headers: {
        Accept: accept,
        "User-Agent": "TradeVeto-Sprint31CompetitiveProbe/1.0",
        "X-TradeVeto-Probe": "sprint31-competitive-leadership",
      },
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });
    return {
      bodyText: await response.text().catch(() => ""),
      key,
      latencyMs: Math.round(performance.now() - started),
      path,
      statusCode: response.status,
    };
  } finally {
    clearTimeout(timeout);
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
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function stripTrailingSlash(value) {
  return String(value).replace(/\/+$/g, "");
}

await main();
