#!/usr/bin/env node

import { createHmac, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import pg from "pg";

const { Pool } = pg;

const baseUrl = stripTrailingSlash(process.env.TRADEVETO_PHASE25_INSTITUTIONAL_BASE_URL ?? "https://tradeveto.com");
const artifactRoot = process.env.TRADEVETO_PHASE25_INSTITUTIONAL_ARTIFACT_ROOT ?? "";
const outputPath = process.env.TRADEVETO_PHASE25_INSTITUTIONAL_OUTPUT
  ?? (artifactRoot ? join(artifactRoot, "institutional-operations-boundary.json") : "");
const ledgerOutputPath = process.env.TRADEVETO_PHASE25_INSTITUTIONAL_LEDGER_OUTPUT
  ?? (artifactRoot ? join(artifactRoot, "operating-ledger.csv") : "");
const timeoutMs = positiveInteger(process.env.TRADEVETO_PHASE25_INSTITUTIONAL_TIMEOUT_MS, 15_000);
const createProbeIdentity = process.env.TRADEVETO_PHASE25_INSTITUTIONAL_CREATE_PROBE_USER !== "false";
const cleanupProbeIdentity = process.env.TRADEVETO_PHASE25_INSTITUTIONAL_CLEANUP_PROBE_USER !== "false";
const startedAt = new Date().toISOString();

let probeIdentity = null;
let cookie = process.env.TRADEVETO_PHASE25_INSTITUTIONAL_COOKIE ?? "";
let exitCode = 0;

async function main() {
  try {
    if (!cookie && createProbeIdentity) {
      probeIdentity = await createProductionProbeIdentity();
      await seedPaperOperatingEvidence(probeIdentity);
      cookie = `market_alpha_session=${probeIdentity.sessionToken}`;
    }
    if (!cookie) throw new Error("Authenticated cookie unavailable for institutional operations proof.");

    const [
      auth,
      paperAccount,
      paperPositions,
      paperEvents,
      paperAnalyticsSummary,
      paperAnalyticsTimeline,
      paperAnalyticsGroups,
      paperPage,
      strategyLabsPage,
    ] = await Promise.all([
      request({ path: "/api/auth/me" }),
      request({ path: "/api/paper/account" }),
      request({ path: "/api/paper/positions" }),
      request({ path: "/api/paper/events" }),
      request({ path: "/api/paper/analytics/summary" }),
      request({ path: "/api/paper/analytics/timeline" }),
      request({ path: "/api/paper/analytics/groups" }),
      request({ path: "/paper", accept: "text/html,application/xhtml+xml" }),
      request({ path: "/strategy-labs", accept: "text/html,application/xhtml+xml" }),
    ]);

    const paperPayload = {
      account: parseJson(paperAccount.bodyText),
      analyticsGroups: parseJson(paperAnalyticsGroups.bodyText),
      analyticsSummary: parseJson(paperAnalyticsSummary.bodyText),
      analyticsTimeline: parseJson(paperAnalyticsTimeline.bodyText),
      events: parseJson(paperEvents.bodyText),
      positions: parseJson(paperPositions.bodyText),
    };
    const authPayload = parseJson(auth.bodyText);
    const pageProof = extractPageProof(paperPage.bodyText);
    const ledgerCsv = pageProof.ledgerCsv;
    if (ledgerCsv && ledgerOutputPath) {
      await mkdir(dirname(ledgerOutputPath), { recursive: true });
      await writeFile(ledgerOutputPath, ledgerCsv, "utf8");
    }

    const report = buildReport({
      auth,
      authPayload,
      ledgerCsv,
      pageProof,
      paperPage,
      paperPayload,
      requests: {
        paperAccount,
        paperAnalyticsGroups,
        paperAnalyticsSummary,
        paperAnalyticsTimeline,
        paperEvents,
        paperPage,
        paperPositions,
        strategyLabsPage,
      },
      strategyLabsPage,
    });
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    console.log(serialized);
    if (outputPath) {
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, serialized, "utf8");
    }
    if (report.overallStatus !== "ready") exitCode = 1;
  } catch (error) {
    exitCode = 1;
    const failure = {
      baseUrl,
      error: error instanceof Error ? error.message : "Phase 25.5 institutional operations proof failed",
      generatedAt: new Date().toISOString(),
      overallStatus: "not_ready",
      startedAt,
    };
    const serialized = `${JSON.stringify(failure, null, 2)}\n`;
    console.error(serialized);
    if (outputPath) {
      await mkdir(dirname(outputPath), { recursive: true }).catch(() => undefined);
      await writeFile(outputPath, serialized, "utf8").catch(() => undefined);
    }
  } finally {
    if (probeIdentity && cleanupProbeIdentity) {
      await cleanupProductionProbeIdentity(probeIdentity).catch((error) => {
        console.warn("[phase25-institutional] probe identity cleanup failed", error instanceof Error ? error.message : error);
        exitCode = exitCode || 1;
      });
    }
    process.exitCode = exitCode;
  }
}

function buildReport(input) {
  const blockers = [];
  const authOk = input.auth.statusCode === 200
    && input.authPayload?.authenticated === true
    && (input.authPayload?.entitlement?.isPremium === true || input.authPayload?.entitlement?.isAdmin === true);
  const paperRows = Array.isArray(input.paperPayload.positions?.rows) ? input.paperPayload.positions.rows : [];
  const eventRows = Array.isArray(input.paperPayload.events?.rows) ? input.paperPayload.events.rows : [];
  const timelineRows = Array.isArray(input.paperPayload.analyticsTimeline?.rows) ? input.paperPayload.analyticsTimeline.rows : [];
  const groupRows = Array.isArray(input.paperPayload.analyticsGroups?.rows) ? input.paperPayload.analyticsGroups.rows : [];
  const ledgerRows = ledgerRowCount(input.ledgerCsv);
  const ledgerHash = input.ledgerCsv ? deterministicLedgerHash(input.ledgerCsv) : "";
  const pageHash = String(input.pageProof.sectionAttrs["data-ledger-integrity-hash"] ?? "");
  const lifecyclePct = numberOrNull(input.pageProof.sectionAttrs["data-lifecycle-evidence-pct"]);
  const revisionPct = numberOrNull(input.pageProof.sectionAttrs["data-revision-traceability-pct"]);
  const replayBackedAutopsyCount = numberOrNull(input.pageProof.sectionAttrs["data-replay-backed-autopsy-count"]);
  const noFabricationEvidence = [
    input.paperPage.bodyText,
    input.strategyLabsPage.bodyText,
    input.ledgerCsv,
  ].every((text) => !/(broker execution confirmed|live broker fill|real-money return confirmed|account reconciliation passed|compliance approval granted|guaranteed return)/i.test(text ?? ""));

  if (!authOk) blockers.push("Authenticated premium probe did not pass.");
  if (!input.pageProof.hasPanel) blockers.push("Institutional Portfolio Operations panel was not rendered on /paper.");
  if (input.pageProof.sectionAttrs["data-broker-boundary"] !== "not_integrated") blockers.push("Broker boundary is not explicitly marked not_integrated.");
  if (input.pageProof.brokerAttrs["data-broker-can-place-orders"] !== "false") blockers.push("Broker order placement boundary is not blocked.");
  if (input.pageProof.brokerAttrs["data-broker-can-read-fills"] !== "false") blockers.push("Broker fill import boundary is not blocked.");
  if (lifecyclePct !== 100) blockers.push(`Lifecycle evidence lineage is ${formatProbePct(lifecyclePct)}, not 100%.`);
  if (revisionPct !== 100) blockers.push(`Strategy revision traceability is ${formatProbePct(revisionPct)}, not 100%.`);
  if (input.pageProof.sectionAttrs["data-ledger-integrity"] !== "pass") blockers.push("Operating ledger integrity is not pass.");
  if (!input.ledgerCsv || ledgerRows <= 0) blockers.push("Operating ledger CSV export was not decoded from /paper.");
  if (ledgerHash !== pageHash) blockers.push("Operating ledger deterministic hash does not match the rendered audit manifest.");
  if (!input.ledgerCsv.includes("evidence_lineage") || !input.ledgerCsv.includes("boundary_disclosure")) blockers.push("Operating ledger CSV is missing evidence lineage or boundary disclosure columns.");
  if (!input.ledgerCsv.includes("Broker integration boundary")) blockers.push("Operating ledger CSV is missing broker boundary row.");
  if (paperRows.length < 3) blockers.push("Authenticated paper positions proof has fewer than 3 seeded rows.");
  if (eventRows.length < 3) blockers.push("Authenticated paper event ledger proof has fewer than 3 seeded rows.");
  if (timelineRows.length < 2) blockers.push("Authenticated paper analytics timeline proof has fewer than 2 checkpoints.");
  if (groupRows.length < 1) blockers.push("Authenticated paper analytics group proof is missing.");
  if ((replayBackedAutopsyCount ?? 0) <= 0) blockers.push("Replay-backed Strategy Labs autopsy proof is unavailable in the rendered operating manifest.");
  if (!noFabricationEvidence) blockers.push("Forbidden broker/fill/return/compliance claim pattern appeared in proof output.");
  if (input.strategyLabsPage.statusCode !== 200) blockers.push(`/strategy-labs returned ${input.strategyLabsPage.statusCode}.`);

  return {
    auth: {
      authenticated: authOk,
      latencyMs: input.auth.latencyMs,
      statusCode: input.auth.statusCode,
    },
    baseUrl,
    blockers,
    brokerBoundary: {
      canPlaceOrders: input.pageProof.brokerAttrs["data-broker-can-place-orders"] ?? null,
      canReadBrokerFills: input.pageProof.brokerAttrs["data-broker-can-read-fills"] ?? null,
      provider: input.pageProof.brokerAttrs["data-broker-provider"] ?? null,
      status: input.pageProof.sectionAttrs["data-broker-boundary"] ?? null,
    },
    generatedAt: new Date().toISOString(),
    ledger: {
      csvColumns: ledgerColumnCount(input.ledgerCsv),
      exportIntegrityHash: pageHash,
      exportIntegrityHashAlgorithm: input.pageProof.auditAttrs["data-export-integrity-hash-algorithm"] ?? null,
      hashVerification: ledgerHash && pageHash && ledgerHash === pageHash ? "pass" : "fail",
      integrity: input.pageProof.sectionAttrs["data-ledger-integrity"] ?? null,
      outputPath: ledgerOutputPath || null,
      rowCount: ledgerRows,
    },
    lifecycle: {
      evidenceBoundLifecyclePct: lifecyclePct,
      positionRows: paperRows.length,
    },
    noFabricationEvidence: {
      forbiddenClaimPatternsFound: !noFabricationEvidence,
      prohibitedBoundary: "no fake fills, broker state, account statements, compliance workflow, real-money returns, or guaranteed outcomes",
    },
    operatingScore: numberOrNull(input.pageProof.sectionAttrs["data-operating-score"]),
    overallStatus: blockers.length ? "not_ready" : "ready",
    paperEvidence: {
      accountStatusCode: input.requests.paperAccount.statusCode,
      analyticsGroupRows: groupRows.length,
      analyticsSummaryStatusCode: input.requests.paperAnalyticsSummary.statusCode,
      analyticsTimelineRows: timelineRows.length,
      eventRows: eventRows.length,
      positionsStatusCode: input.requests.paperPositions.statusCode,
    },
    probeIdentity: probeIdentity
      ? {
          cleanupRequested: cleanupProbeIdentity,
          created: true,
          email: probeIdentity.email,
          userId: probeIdentity.userId,
        }
      : { created: false },
    proofScope: "Authenticated production proof for evidence-bound paper/strategy operations, operating ledger export integrity, lifecycle evidence lineage, revision traceability, replay-backed autopsy presence where Strategy Labs evidence exists, and explicit no-broker boundary. This is not broker reconciliation, live fill import, compliance certification, or real-money return proof.",
    replayBackedAutopsyCount,
    requests: Object.fromEntries(Object.entries(input.requests).map(([key, sample]) => [key, { latencyMs: sample.latencyMs, statusCode: sample.statusCode }])),
    revisionTraceabilityPct: revisionPct,
    startedAt,
    timeoutMs,
    unsupportedClaims: [
      "No broker/account reconciliation proof is claimed.",
      "No live broker integration, fill import, account statement, or compliance workflow is claimed.",
      "No real-money returns or institutional-grade external audit is claimed.",
    ],
  };
}

async function request({ accept = "application/json,text/html;q=0.9,*/*;q=0.8", path }) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      cache: "no-store",
      headers: {
        Accept: accept,
        Cookie: cookie,
        "User-Agent": "TradeVeto-Phase25InstitutionalBoundaryProbe/1.0",
        "X-TradeVeto-Probe": "phase25-institutional-operations-boundary",
      },
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });
    const bodyText = await response.text().catch(() => "");
    return {
      bodyText,
      latencyMs: Math.round(performance.now() - started),
      path,
      statusCode: response.status,
    };
  } catch (error) {
    return {
      bodyText: "",
      error: error instanceof Error ? error.message : "Unknown probe request error",
      latencyMs: Math.round(performance.now() - started),
      path,
      statusCode: 599,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function createProductionProbeIdentity() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to create a Phase 25.5 institutional probe user.");
  const sessionSecret = sessionHashSecret(process.env);
  const pool = new Pool({ connectionString: databaseUrl });
  const suffix = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const email = `phase25-institutional-${suffix}@tradeveto-probe.local`;
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
        VALUES ($1, 'Phase 25.5 Institutional Boundary Probe', true, now(), 'active', 'user', 'America/New_York', 'advanced', true, now(), now())
        RETURNING id::text
      `,
      [email],
    );
    const userId = userResult.rows[0]?.id;
    if (!userId) throw new Error("Failed to create institutional operations probe user.");
    await client.query(
      `
        INSERT INTO user_sessions (user_id, session_token_hash, expires_at, created_at)
        VALUES ($1::uuid, $2, now() + interval '2 hours', now())
      `,
      [userId, sessionTokenHash],
    );
    await client.query(
      `
        INSERT INTO user_subscriptions (user_id, status, plan, current_period_end, created_at, updated_at)
        VALUES ($1::uuid, 'active', 'premium', now() + interval '2 hours', now(), now())
        ON CONFLICT (user_id)
        DO UPDATE SET status = 'active', plan = 'premium', current_period_end = EXCLUDED.current_period_end, updated_at = now()
      `,
      [userId],
    );
    await client.query(
      `
        INSERT INTO legal_acceptances (user_id, document_type, document_version, accepted_at)
        SELECT $1::uuid, type, version, now()
        FROM legal_documents
        ON CONFLICT (user_id, document_type, document_version) DO NOTHING
      `,
      [userId],
    );
    await client.query("COMMIT");
    return { accountName: `phase25-institutional-${suffix}`, email, sessionToken, userId };
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client?.release();
    await pool.end().catch(() => undefined);
  }
}

async function seedPaperOperatingEvidence(identity) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to seed Phase 25.5 institutional evidence.");
  const pool = new Pool({ connectionString: databaseUrl });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const accountResult = await client.query(
      `
        INSERT INTO paper_accounts (
          name,
          starting_balance,
          cash_balance,
          equity_value,
          realized_pnl,
          max_position_pct,
          risk_per_trade_pct,
          max_open_positions,
          enabled,
          user_id,
          created_at,
          updated_at
        )
        VALUES ($1, 50000, 40750, 9250, -41, 0.20, 0.02, 8, true, $2::uuid, now(), now())
        RETURNING id::text
      `,
      [identity.accountName, identity.userId],
    );
    const accountId = accountResult.rows[0]?.id;
    if (!accountId) throw new Error("Failed to create probe paper account.");

    const positions = [
      {
        closeReason: null,
        closedAt: null,
        entry: 105,
        exit: null,
        finalDecision: "WATCH",
        id: randomUuid(),
        openedAt: "2026-05-20T14:30:00.000Z",
        quantity: 18,
        rating: "A",
        realizedPnl: 0,
        recommendationQuality: "watch",
        returnPct: null,
        setupType: "pullback",
        status: "OPEN",
        stop: 97,
        symbol: "AMD",
        target: 128,
        unrealizedPnl: 264,
      },
      {
        closeReason: null,
        closedAt: null,
        entry: 910,
        exit: null,
        finalDecision: "WATCH",
        id: randomUuid(),
        openedAt: "2026-05-21T14:30:00.000Z",
        quantity: 5,
        rating: "B",
        realizedPnl: 0,
        recommendationQuality: "watch",
        returnPct: null,
        setupType: "macro_retest",
        status: "OPEN",
        stop: 862,
        symbol: "NVDA",
        target: 990,
        unrealizedPnl: -240,
      },
      {
        closeReason: "target review",
        closedAt: "2026-05-22T19:30:00.000Z",
        entry: 105,
        exit: 112,
        finalDecision: "WATCH",
        id: randomUuid(),
        openedAt: "2026-05-18T14:30:00.000Z",
        quantity: 12,
        rating: "A",
        realizedPnl: 84,
        recommendationQuality: "watch",
        returnPct: 0.0666667,
        setupType: "pullback",
        status: "CLOSED",
        stop: 97,
        symbol: "AMD",
        target: 128,
        unrealizedPnl: null,
      },
      {
        closeReason: "risk invalidation",
        closedAt: "2026-05-23T19:30:00.000Z",
        entry: 250,
        exit: 245,
        finalDecision: "MANUAL",
        id: randomUuid(),
        openedAt: "2026-05-19T14:30:00.000Z",
        quantity: 25,
        rating: "C",
        realizedPnl: -125,
        recommendationQuality: "manual",
        returnPct: -0.02,
        setupType: "MANUAL",
        status: "CLOSED",
        stop: 242,
        symbol: "TSLA",
        target: 278,
        unrealizedPnl: null,
      },
    ];

    for (const position of positions) {
      await client.query(
        `
          INSERT INTO paper_positions (
            id,
            account_id,
            symbol,
            status,
            opened_at,
            closed_at,
            entry_price,
            exit_price,
            quantity,
            stop_loss,
            target_price,
            final_decision,
            recommendation_quality,
            entry_status,
            setup_type,
            rating,
            realized_pnl,
            unrealized_pnl,
            return_pct,
            close_reason,
            user_id,
            created_at,
            updated_at
          )
          VALUES (
            $1::uuid, $2::uuid, $3, $4, $5::timestamptz, $6::timestamptz, $7, $8, $9, $10, $11,
            $12, $13, 'watch', $14, $15, $16, $17, $18, $19, $20::uuid, now(), now()
          )
        `,
        [
          position.id,
          accountId,
          position.symbol,
          position.status,
          position.openedAt,
          position.closedAt,
          position.entry,
          position.exit,
          position.quantity,
          position.stop,
          position.target,
          position.finalDecision,
          position.recommendationQuality,
          position.setupType,
          position.rating,
          position.realizedPnl,
          position.unrealizedPnl,
          position.returnPct,
          position.closeReason,
          identity.userId,
        ],
      );
    }

    const events = [
      { cash: -1890, createdAt: "2026-05-20T14:31:00.000Z", pnl: 0, positionId: positions[0].id, price: 105, quantity: 18, reason: "phase 25.5 evidence-bound paper open, not broker fill", symbol: "AMD", type: "OPEN" },
      { cash: -4550, createdAt: "2026-05-21T14:31:00.000Z", pnl: 0, positionId: positions[1].id, price: 910, quantity: 5, reason: "phase 25.5 evidence-bound paper open, not broker fill", symbol: "NVDA", type: "OPEN" },
      { cash: 1344, createdAt: "2026-05-22T19:31:00.000Z", pnl: 84, positionId: positions[2].id, price: 112, quantity: 12, reason: "paper close, deterministic ledger proof only", symbol: "AMD", type: "CLOSE" },
      { cash: 6125, createdAt: "2026-05-23T19:31:00.000Z", pnl: -125, positionId: positions[3].id, price: 245, quantity: 25, reason: "paper invalidation, deterministic ledger proof only", symbol: "TSLA", type: "CLOSE" },
    ];
    for (const event of events) {
      await client.query(
        `
          INSERT INTO paper_trade_events (
            account_id,
            position_id,
            symbol,
            event_type,
            event_reason,
            price,
            quantity,
            cash_delta,
            pnl_delta,
            created_at,
            user_id
          )
          VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz, $11::uuid)
        `,
        [accountId, event.positionId, event.symbol, event.type, event.reason, event.price, event.quantity, event.cash, event.pnl, event.createdAt, identity.userId],
      );
    }
    await client.query("COMMIT");
    identity.accountId = accountId;
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client?.release();
    await pool.end().catch(() => undefined);
  }
}

async function cleanupProductionProbeIdentity(identity) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;
  const pool = new Pool({ connectionString: databaseUrl });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("DELETE FROM paper_trade_events WHERE user_id = $1::uuid", [identity.userId]);
    await client.query("DELETE FROM paper_positions WHERE user_id = $1::uuid", [identity.userId]);
    await client.query("DELETE FROM paper_accounts WHERE user_id = $1::uuid", [identity.userId]);
    await client.query("DELETE FROM users WHERE id = $1::uuid AND email = $2", [identity.userId, identity.email]);
    await client.query("COMMIT");
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client?.release();
    await pool.end().catch(() => undefined);
  }
}

function extractPageProof(html) {
  const sectionTag = findTagWithAttribute(html, "data-institutional-portfolio-operations");
  const auditTag = findTagWithAttribute(html, "data-audit-manifest");
  const brokerTag = findTagWithAttribute(html, "data-broker-boundary-card");
  const exportTag = findTagWithAttribute(html, "data-operating-ledger-export");
  const exportAttrs = parseAttributes(exportTag);
  const ledgerCsv = decodeLedgerCsv(exportAttrs.href ?? "");
  return {
    auditAttrs: parseAttributes(auditTag),
    brokerAttrs: parseAttributes(brokerTag),
    exportAttrs,
    hasPanel: Boolean(sectionTag),
    ledgerCsv,
    sectionAttrs: parseAttributes(sectionTag),
  };
}

function findTagWithAttribute(html, attributeName) {
  const pattern = new RegExp(`<[a-zA-Z][^>]*${attributeName}=(?:"true"|\\{true\\}|['"]true['"])[^>]*>`, "i");
  const match = html.match(pattern);
  return match?.[0] ?? "";
}

function parseAttributes(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([a-zA-Z0-9:-]+)="([^"]*)"/g)) {
    attrs[match[1]] = decodeHtml(match[2] ?? "");
  }
  return attrs;
}

function decodeLedgerCsv(href) {
  if (!href.startsWith("data:text/csv")) return "";
  const commaIndex = href.indexOf(",");
  if (commaIndex < 0) return "";
  try {
    return decodeURIComponent(href.slice(commaIndex + 1));
  } catch {
    return "";
  }
}

function deterministicLedgerHash(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function ledgerColumnCount(csv) {
  if (!csv) return 0;
  const header = csv.split(/\r?\n/, 1)[0] ?? "";
  return splitCsvLine(header).length;
}

function ledgerRowCount(csv) {
  if (!csv) return 0;
  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return Math.max(0, lines.length - 1);
}

function splitCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
      continue;
    }
    cell += char;
  }
  cells.push(cell);
  return cells;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function decodeHtml(value) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "na") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatProbePct(value) {
  return value === null ? "N/A" : `${value.toFixed(0)}%`;
}

function randomUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const hex = randomBytes(16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

await main();
