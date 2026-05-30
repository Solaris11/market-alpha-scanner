#!/usr/bin/env node

import { createHmac, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import pg from "pg";

const { Pool } = pg;

const baseUrl = stripTrailingSlash(process.env.TRADEVETO_SPRINT31_AI_COPILOT_BASE_URL ?? "https://tradeveto.com");
const artifactRoot = process.env.TRADEVETO_SPRINT31_AI_COPILOT_ARTIFACT_ROOT
  ?? join(process.cwd(), "../docs/ops/artifacts/sprint-31-1-ai-trading-copilot");
const outputPath = process.env.TRADEVETO_SPRINT31_AI_COPILOT_OUTPUT ?? join(artifactRoot, "ai-trading-copilot-proof.json");
const timeoutMs = positiveInteger(process.env.TRADEVETO_SPRINT31_AI_COPILOT_TIMEOUT_MS, 25_000);
const startedAt = new Date().toISOString();

const QUESTIONS = [
  { expectedIntent: "symbol_explanation", key: "symbol_movement", question: "Why is AMD moving today?" },
  { expectedIntent: "natural_language_search", key: "ai_momentum_search", question: "Show AI stocks with improving momentum." },
  { expectedIntent: "portfolio", key: "portfolio_risk", question: "Which holdings have elevated risk?" },
  { expectedIntent: "what_changed", key: "what_changed", question: "What changed since yesterday?" },
  { expectedIntent: "similar_symbols", key: "similar_symbols", question: "Which symbols look similar to NVDA?" },
];

let probeIdentity = null;
let cookie = process.env.TRADEVETO_SPRINT31_AI_COPILOT_COOKIE ?? "";
let csrfToken = "";
let exitCode = 0;

async function main() {
  try {
    if (!cookie && process.env.TRADEVETO_SPRINT31_AI_COPILOT_CREATE_PROBE_USER !== "false") {
      probeIdentity = await createProductionProbeUser();
      cookie = `market_alpha_session=${probeIdentity.sessionToken}`;
    }
    if (!cookie) throw new Error("Authenticated cookie unavailable for Sprint 31.1 AI trading copilot proof.");

    const csrf = await fetchCsrfToken();
    csrfToken = csrf.token;
    cookie = mergeCookieHeader(cookie, csrf.cookie);

    const terminal = await requestText("/terminal", "text/html", "GET");
    const questionResults = [];
    for (const item of QUESTIONS) {
      questionResults.push(await askQuestion(item));
    }

    const blockers = [
      ...terminalBlockers(terminal),
      ...questionResults.flatMap((result) => result.blockers),
    ];
    const report = {
      baseUrl,
      blockers,
      finalVerdict: blockers.length ? "TRADEVETO AI TRADING COPILOT NOT ACCOMPLISHED" : "TRADEVETO AI TRADING COPILOT ACCOMPLISHED",
      generatedAt: new Date().toISOString(),
      noFakeMarketClaims: true,
      overallStatus: blockers.length ? "not_ready" : "ready",
      probePortfolio: probeIdentity?.paperPortfolio ?? null,
      proofBoundary: "This probe verifies authenticated natural-language market Q&A, symbol movement explanation, market search, portfolio copilot behavior, conversation memory payloads, traceability fields, and no-fabrication guardrails. It does not claim autonomous trading, guaranteed outcomes, or broker execution.",
      questions: questionResults,
      startedAt,
      terminalPage: {
        bytes: terminal.bodyText.length,
        containsCopilotCopy: /AI Trading Copilot|Ask TradeVeto|copilot/i.test(terminal.bodyText),
        latencyMs: terminal.latencyMs,
        statusCode: terminal.statusCode,
      },
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
      error: error instanceof Error ? error.message : "Sprint 31.1 AI trading copilot proof failed",
      generatedAt: new Date().toISOString(),
      noFakeMarketClaims: true,
      overallStatus: "not_ready",
      startedAt,
    };
    await mkdir(dirname(outputPath), { recursive: true }).catch(() => undefined);
    await writeFile(outputPath, `${JSON.stringify(failure, null, 2)}\n`, "utf8").catch(() => undefined);
    console.error(JSON.stringify(failure, null, 2));
  } finally {
    if (probeIdentity && process.env.TRADEVETO_SPRINT31_AI_COPILOT_CLEANUP_PROBE_USER !== "false") {
      await cleanupProductionProbeUser(probeIdentity).catch((error) => {
        console.warn("[sprint31-ai-copilot] probe cleanup failed", error instanceof Error ? error.message : error);
        exitCode = exitCode || 1;
      });
    }
    process.exitCode = exitCode;
  }
}

async function askQuestion(item) {
  const response = await requestJson("/api/research/copilot", "POST", {
    history: [
      { content: "I am using TradeVeto as a research workflow and tracking AMD plus MU.", role: "user" },
      { content: "I will keep answers grounded in the latest TradeVeto packet.", role: "assistant" },
    ],
    mode: "deep_dive",
    question: item.question,
  });
  const answer = response.payload?.answer ?? null;
  const blockers = [];
  if (response.statusCode !== 200) blockers.push(`${item.key} returned ${response.statusCode}`);
  if (response.payload?.ok !== true || !answer) blockers.push(`${item.key} missing ok answer payload`);
  if (answer?.intent !== item.expectedIntent) blockers.push(`${item.key} intent ${answer?.intent ?? "missing"} did not match ${item.expectedIntent}`);
  if (!Array.isArray(answer?.citations) || answer.citations.length === 0) blockers.push(`${item.key} missing citations`);
  if (!Array.isArray(answer?.traceability) || answer.traceability.length === 0) blockers.push(`${item.key} missing traceability`);
  if (answer?.unsupportedClaimsDetected !== false) blockers.push(`${item.key} unsupported claims flag was not false`);
  if (!/not financial advice/i.test(String(answer?.safetyLanguage ?? ""))) blockers.push(`${item.key} missing Not financial advice safety language`);
  const serialized = JSON.stringify(answer ?? {});
  if (/\b(buy now|sell now|guaranteed|sure profit|will definitely|must buy|must sell)\b/i.test(serialized)) blockers.push(`${item.key} contained forbidden direct-action or certainty language`);
  if (/\bReuters reported|Bloomberg reported|unconfirmed rumor\b/i.test(serialized)) blockers.push(`${item.key} appeared to invent source language`);
  if (item.expectedIntent === "natural_language_search" && (!Array.isArray(answer?.marketSearchResults) || answer.marketSearchResults.length === 0)) blockers.push(`${item.key} missing market search results`);
  if (item.expectedIntent === "portfolio" && !answer?.citations?.some((citation) => citation.sourceType === "portfolio")) blockers.push(`${item.key} missing portfolio citation`);
  if (item.expectedIntent === "symbol_explanation" && !answer?.marketSearchResults?.some((result) => result.symbol === "AMD")) blockers.push(`${item.key} missing AMD traceable market-search result`);

  return {
    answerSummary: answer ? {
      actionCount: Array.isArray(answer.opportunityActions) ? answer.opportunityActions.length : 0,
      citationCount: Array.isArray(answer.citations) ? answer.citations.length : 0,
      intent: answer.intent,
      marketSearchCount: Array.isArray(answer.marketSearchResults) ? answer.marketSearchResults.length : 0,
      referencedSymbols: answer.referencedSymbols ?? [],
      source: answer.source,
      traceabilityCount: Array.isArray(answer.traceability) ? answer.traceability.length : 0,
    } : null,
    blockers,
    expectedIntent: item.expectedIntent,
    key: item.key,
    latencyMs: response.latencyMs,
    question: item.question,
    statusCode: response.statusCode,
  };
}

function terminalBlockers(response) {
  const blockers = [];
  if (response.statusCode !== 200) blockers.push(`/terminal returned ${response.statusCode}`);
  if (!/copilot/i.test(response.bodyText)) blockers.push("/terminal missing copilot copy");
  return blockers;
}

async function requestJson(path, method, body) {
  const response = await requestText(path, "application/json", method, body);
  return { ...response, payload: parseJson(response.bodyText) };
}

async function requestText(path, accept, method = "GET", body = undefined) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const bodyText = body ? JSON.stringify(body) : undefined;
    const response = await fetch(`${baseUrl}${path}`, {
      body: bodyText,
      cache: "no-store",
      headers: {
        Accept: accept,
        Cookie: cookie,
        Origin: baseUrl,
        "User-Agent": "TradeVeto-Sprint31AICopilotProbe/1.0",
        "X-TradeVeto-Probe": "sprint31-ai-trading-copilot",
        ...(bodyText ? { "Content-Type": "application/json", "x-csrf-token": csrfToken } : {}),
      },
      method,
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

async function fetchCsrfToken() {
  const response = await fetch(`${baseUrl}/api/auth/csrf`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Cookie: cookie,
      "User-Agent": "TradeVeto-Sprint31AICopilotProbe/1.0",
    },
    method: "GET",
  });
  const payload = await response.json().catch(() => null);
  const token = typeof payload?.csrfToken === "string" ? payload.csrfToken : "";
  if (!response.ok || !token) throw new Error("CSRF token unavailable for Sprint 31.1 AI trading copilot probe.");
  const setCookie = response.headers.get("set-cookie") ?? "";
  const csrfCookie = setCookie.match(/market_alpha_csrf=([^;,]+)/)?.[1] ?? token;
  return { cookie: `market_alpha_csrf=${csrfCookie}`, token };
}

async function createProductionProbeUser() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to create a Sprint 31.1 AI copilot probe user.");
  const sessionSecret = sessionHashSecret(process.env);
  const pool = new Pool({ connectionString: databaseUrl });
  const suffix = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const email = `sprint31-ai-copilot-${suffix}@tradeveto-probe.local`;
  const accountName = `Sprint 31 AI Copilot Probe ${suffix}`;
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
        VALUES ($1, 'Sprint 31 AI Copilot Probe', true, now(), 'active', 'admin', 'America/New_York', 'advanced', true, now(), now())
        RETURNING id::text
      `,
      [email],
    );
    const userId = userResult.rows[0]?.id;
    if (!userId) throw new Error("Failed to create Sprint 31.1 probe user.");
    await client.query(
      `
        INSERT INTO legal_acceptances (user_id, document_type, document_version, accepted_at)
        SELECT $1::uuid, type, version, now()
        FROM legal_documents
        ON CONFLICT (user_id, document_type, document_version) DO NOTHING
      `,
      [userId],
    );
    await client.query(
      `
        INSERT INTO user_sessions (user_id, session_token_hash, expires_at, created_at, created_ip, user_agent, device_label, auth_method, last_seen_at)
        VALUES ($1::uuid, $2, now() + interval '2 hours', now(), '127.0.0.1', 'TradeVeto-Sprint31AICopilotProbe/1.0', 'Probe', 'ai_copilot_probe', now())
      `,
      [userId, sessionTokenHash],
    );
    const accountResult = await client.query(
      `
        INSERT INTO paper_accounts (name, user_id, starting_balance, cash_balance, equity_value, realized_pnl, enabled, created_at, updated_at)
        VALUES ($1, $2::uuid, 100000, 35000, 65000, 0, true, now(), now())
        RETURNING id::text
      `,
      [accountName, userId],
    );
    const accountId = accountResult.rows[0]?.id;
    if (!accountId) throw new Error("Failed to create Sprint 31.1 probe paper account.");
    await client.query(
      `
        INSERT INTO paper_positions (
          account_id,
          user_id,
          symbol,
          status,
          opened_at,
          entry_price,
          quantity,
          stop_loss,
          target_price,
          unrealized_pnl,
          final_decision,
          recommendation_quality,
          entry_status,
          setup_type,
          rating,
          created_at,
          updated_at
        )
        VALUES
          ($1::uuid, $2::uuid, 'AMD', 'OPEN', now() - interval '2 days', 105, 250, 96, 126, 850, 'WATCH', 'watch', 'watch', 'MOMENTUM_CONTINUATION', 'watch', now(), now()),
          ($1::uuid, $2::uuid, 'MU', 'OPEN', now() - interval '1 day', 80, 300, 72, 95, -420, 'WATCH', 'watch', 'watch', 'HIGH_FRAGILITY_MOMENTUM', 'watch', now(), now())
      `,
      [accountId, userId],
    );
    await client.query("COMMIT");
    return {
      email,
      paperPortfolio: { accountName, positions: ["AMD", "MU"] },
      sessionToken,
      userId,
    };
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client?.release();
    await pool.end().catch(() => undefined);
  }
}

async function cleanupProductionProbeUser(identity) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query("DELETE FROM paper_positions WHERE user_id = $1::uuid", [identity.userId]);
    await pool.query("DELETE FROM paper_accounts WHERE user_id = $1::uuid", [identity.userId]);
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

function requestCookieMap(header) {
  return Object.fromEntries(
    String(header)
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index >= 0 ? [part.slice(0, index), part.slice(index + 1)] : [part, ""];
      }),
  );
}

function mergeCookieHeader(left, right) {
  const merged = { ...requestCookieMap(left), ...requestCookieMap(right) };
  return Object.entries(merged).map(([key, value]) => `${key}=${value}`).join("; ");
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

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function stripTrailingSlash(value) {
  return String(value).replace(/\/+$/g, "");
}

await main();
