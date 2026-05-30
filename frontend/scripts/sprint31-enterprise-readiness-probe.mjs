#!/usr/bin/env node

import { createHmac, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import pg from "pg";

const { Pool } = pg;

const baseUrl = stripTrailingSlash(process.env.TRADEVETO_SPRINT31_ENTERPRISE_BASE_URL ?? "https://tradeveto.com");
const artifactRoot = process.env.TRADEVETO_SPRINT31_ENTERPRISE_ARTIFACT_ROOT
  ?? join(process.cwd(), "../docs/ops/artifacts/sprint-31-0-enterprise-readiness");
const outputPath = process.env.TRADEVETO_SPRINT31_ENTERPRISE_OUTPUT ?? join(artifactRoot, "enterprise-readiness-proof.json");
const timeoutMs = positiveInteger(process.env.TRADEVETO_SPRINT31_ENTERPRISE_TIMEOUT_MS, 20_000);
const startedAt = new Date().toISOString();

let probeIdentity = null;
let cookie = process.env.TRADEVETO_SPRINT31_ENTERPRISE_COOKIE ?? "";
let exitCode = 0;

async function main() {
  try {
    if (!cookie && process.env.TRADEVETO_SPRINT31_ENTERPRISE_CREATE_PROBE_ADMIN !== "false") {
      probeIdentity = await createProductionProbeAdmin();
      cookie = `market_alpha_session=${probeIdentity.sessionToken}`;
    }
    if (!cookie) throw new Error("Authenticated cookie unavailable for Sprint 31 enterprise readiness proof.");

    const [page, readiness, oauthProviders] = await Promise.all([
      requestText("/enterprise", "text/html"),
      requestJson("/api/enterprise/readiness"),
      requestJson("/api/auth/oauth-providers", false),
    ]);
    const model = readiness.payload?.model ?? null;
    const blockers = [
      ...pageBlockers(page),
      ...readinessBlockers(readiness, model),
      ...oauthProviderBlockers(oauthProviders),
    ];
    const report = {
      baseUrl,
      blockers,
      enterprisePage: {
        bytes: page.bodyText.length,
        containsAuditCopy: /audit/i.test(page.bodyText),
        containsSsoCopy: /SSO|SAML|OIDC|Microsoft|Google/i.test(page.bodyText),
        latencyMs: page.latencyMs,
        statusCode: page.statusCode,
      },
      finalVerdict: blockers.length ? "TRADEVETO ENTERPRISE READINESS PLATFORM NOT ACCOMPLISHED" : "TRADEVETO ENTERPRISE READINESS PLATFORM STRONG PARTIAL ACCOMPLISHED",
      generatedAt: new Date().toISOString(),
      noFakeEnterpriseClaims: true,
      oauthProviders: oauthProviders.payload ?? null,
      overallStatus: blockers.length ? "not_ready" : "strong_partial",
      proofBoundary: "This probe verifies production enterprise architecture, RBAC, organization workspace readiness, SSO visibility, audit/session categories, and API availability. It does not fabricate live SAML/OIDC customer IdP login, compliance attestation, or paid enterprise customers.",
      readinessApi: {
        latencyMs: readiness.latencyMs,
        ok: readiness.payload?.ok === true,
        statusCode: readiness.statusCode,
      },
      readinessModel: model ? {
        accountTypes: model.accountTypes,
        analyticsCount: model.analytics?.length ?? 0,
        auditCoverageCount: model.auditCoverage?.length ?? 0,
        certificationGates: model.certificationGates,
        organization: model.organization,
        overallStatus: model.overallStatus,
        permissionRoles: model.permissionMatrix?.map((row) => row.role) ?? [],
        sessionControlsCount: model.sessionControls?.length ?? 0,
        ssoProviders: model.ssoConnections?.map((connection) => ({
          configured: connection.configured,
          provider: connection.provider,
          status: connection.status,
        })) ?? [],
      } : null,
      startedAt,
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
      error: error instanceof Error ? error.message : "Sprint 31 enterprise readiness proof failed",
      generatedAt: new Date().toISOString(),
      noFakeEnterpriseClaims: true,
      overallStatus: "not_ready",
      startedAt,
    };
    await mkdir(dirname(outputPath), { recursive: true }).catch(() => undefined);
    await writeFile(outputPath, `${JSON.stringify(failure, null, 2)}\n`, "utf8").catch(() => undefined);
    console.error(JSON.stringify(failure, null, 2));
  } finally {
    if (probeIdentity && process.env.TRADEVETO_SPRINT31_ENTERPRISE_CLEANUP_PROBE_ADMIN !== "false") {
      await cleanupProductionProbeAdmin(probeIdentity).catch((error) => {
        console.warn("[sprint31-enterprise] probe admin cleanup failed", error instanceof Error ? error.message : error);
        exitCode = exitCode || 1;
      });
    }
    process.exitCode = exitCode;
  }
}

function pageBlockers(page) {
  const blockers = [];
  if (page.statusCode !== 200) blockers.push(`/enterprise returned ${page.statusCode}`);
  if (!/Enterprise Readiness/i.test(page.bodyText)) blockers.push("/enterprise missing readiness heading");
  if (!/Owner|Admin|Manager|Member|Viewer/i.test(page.bodyText)) blockers.push("/enterprise missing permission roles");
  if (!/SAML|OIDC|Microsoft|Google/i.test(page.bodyText)) blockers.push("/enterprise missing SSO provider matrix");
  if (!/audit/i.test(page.bodyText)) blockers.push("/enterprise missing audit copy");
  return blockers;
}

function readinessBlockers(response, model) {
  const blockers = [];
  if (response.statusCode !== 200) blockers.push(`/api/enterprise/readiness returned ${response.statusCode}`);
  if (response.payload?.ok !== true) blockers.push("enterprise readiness response was not ok");
  if (!model) {
    blockers.push("enterprise readiness model missing");
    return blockers;
  }
  const roles = model.permissionMatrix?.map((row) => row.role) ?? [];
  for (const role of ["owner", "admin", "manager", "member", "viewer"]) {
    if (!roles.includes(role)) blockers.push(`permission matrix missing ${role}`);
  }
  for (const provider of ["google", "microsoft", "oidc", "saml"]) {
    if (!model.ssoConnections?.some((connection) => connection.provider === provider)) blockers.push(`SSO matrix missing ${provider}`);
  }
  for (const gate of ["organization_accounts", "workspace_system", "permissions", "audit_logging", "enterprise_authentication", "session_controls", "organization_analytics"]) {
    if (!model.certificationGates?.some((item) => item.key === gate)) blockers.push(`certification gate missing ${gate}`);
  }
  if (!["ready", "strong_partial"].includes(model.overallStatus)) blockers.push(`enterprise readiness status ${model.overallStatus}`);
  if (JSON.stringify(model).match(/compliance certified|broker statement|guaranteed enterprise/i)) blockers.push("model contains unsupported enterprise claim");
  return blockers;
}

function oauthProviderBlockers(response) {
  const blockers = [];
  if (response.statusCode !== 200) blockers.push(`/api/auth/oauth-providers returned ${response.statusCode}`);
  const enterprise = response.payload?.enterprise;
  if (!Array.isArray(enterprise)) blockers.push("oauth providers missing enterprise SSO matrix");
  return blockers;
}

async function requestJson(path, authenticated = true) {
  const response = await requestText(path, "application/json", authenticated);
  return { ...response, payload: parseJson(response.bodyText) };
}

async function requestText(path, accept, authenticated = true) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      cache: "no-store",
      headers: {
        Accept: accept,
        ...(authenticated ? { Cookie: cookie } : {}),
        "User-Agent": "TradeVeto-Sprint31EnterpriseProbe/1.0",
        "X-TradeVeto-Probe": "sprint31-enterprise-readiness",
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
  if (!databaseUrl) throw new Error("DATABASE_URL is required to create a Sprint 31 enterprise probe admin.");
  const sessionSecret = sessionHashSecret(process.env);
  const pool = new Pool({ connectionString: databaseUrl });
  const email = `sprint31-enterprise-${Date.now()}-${randomBytes(4).toString("hex")}@tradeveto-probe.local`;
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
        VALUES ($1, 'Sprint 31 Enterprise Probe', true, now(), 'active', 'admin', 'America/New_York', 'advanced', true, now(), now())
        RETURNING id::text
      `,
      [email],
    );
    const userId = userResult.rows[0]?.id;
    if (!userId) throw new Error("Failed to create Sprint 31 enterprise probe admin.");
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
        VALUES ($1::uuid, $2, now() + interval '2 hours', now(), '127.0.0.1', 'TradeVeto-Sprint31EnterpriseProbe/1.0', 'Probe', 'enterprise_probe', now())
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

function sessionHashSecret(env) {
  const secret = env.TRADEVETO_SESSION_SECRET || env.SESSION_SECRET || env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("TRADEVETO_SESSION_SECRET or SESSION_SECRET is required for probe session creation.");
  return secret;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function stripTrailingSlash(value) {
  return String(value).replace(/\/+$/g, "");
}

await main();
