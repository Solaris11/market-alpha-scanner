import "server-only";

import type { QueryResultRow } from "pg";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { sanitizeAdminAuditMetadata } from "@/lib/security/admin-policy";
import { normalizeWatchlistSymbols } from "@/lib/server/user-watchlist";
import { getPerformanceData } from "@/lib/scanner-data";
import { buildTeamWorkspaceIntelligence, type TeamAuditEvent, type TeamResearchNote, type TeamWorkspace, type TeamWorkspaceMember, type TeamWorkspaceRole, type TeamWorkspaceSystem, type TeamWorkspaceWatchSymbol } from "@/lib/trading/team-intelligence";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";
import { dbQuery, dbTransaction, type DbExecutor } from "./db";
import { getNarrativeMap } from "./narrative-intelligence";
import { requestIp } from "./request-security";
import { getShockMovePatternMap } from "./shock-move-patterns";

const DEFAULT_TEAM_SLUG = "team-workspace";
const DEFAULT_TEAM_NAME = "Team Workspace";

export class TeamWorkspaceAccessError extends Error {
  readonly status: 403 | 404;

  constructor(message: string, status: 403 | 404 = 403) {
    super(message);
    this.name = "TeamWorkspaceAccessError";
    this.status = status;
  }
}

type WorkspaceRow = QueryResultRow & {
  created_at: string;
  description: string | null;
  id: string;
  name: string;
  owner_user_id: string;
  role?: string;
  slug: string;
  updated_at: string;
};

type MemberRow = QueryResultRow & {
  created_at: string;
  display_name: string | null;
  email: string | null;
  role: string;
  user_id: string;
};

type WatchSymbolRow = QueryResultRow & {
  added_by_user_id: string | null;
  created_at: string;
  note: string | null;
  symbol: string;
};

type ResearchNoteRow = QueryResultRow & {
  body: string;
  created_at: string;
  created_by_user_id: string | null;
  id: string;
  symbol: string | null;
  title: string;
  visibility: string;
};

type AuditEventRow = QueryResultRow & {
  action: string;
  actor_user_id: string | null;
  created_at: string;
  id: string;
  metadata: Record<string, unknown> | null;
  target_id: string | null;
  target_type: string;
};

type WorkspaceAccess = {
  role: TeamWorkspaceRole;
  workspace: TeamWorkspace;
};

export async function listTeamWorkspaces(userId: string): Promise<TeamWorkspace[]> {
  const result = await dbQuery<WorkspaceRow>(
    `
      SELECT w.id::text, w.owner_user_id::text, w.name, w.slug, w.description, w.created_at::text, w.updated_at::text
      FROM team_workspaces w
      JOIN team_workspace_members m ON m.workspace_id = w.id
      WHERE m.user_id = $1::uuid
      ORDER BY w.updated_at DESC
      LIMIT 25
    `,
    [userId],
  );
  return result.rows.map(workspaceFromRow);
}

export async function loadTeamWorkspaceSystem(userId: string, workspaceId?: string | null): Promise<TeamWorkspaceSystem> {
  const access = workspaceId ? await getTeamWorkspaceAccess(userId, workspaceId) : await getOrCreateDefaultTeamWorkspaceAccess(userId);
  const [members, sharedWatchlist, notes, auditTrail, opportunityRows] = await Promise.all([
    readTeamWorkspaceMembers(access.workspace.id),
    readTeamWorkspaceWatchlist(access.workspace.id),
    readTeamResearchNotes(access.workspace.id),
    readTeamAuditTrail(access.workspace.id),
    loadOpportunityRows(),
  ]);

  return buildTeamWorkspaceIntelligence({
    auditTrail,
    members,
    notes,
    role: access.role,
    rows: opportunityRows,
    sharedWatchlist,
    workspace: access.workspace,
  });
}

export async function addTeamWorkspaceSymbols(input: { request?: Request; symbols: unknown[]; userId: string; workspaceId?: string | null }): Promise<TeamWorkspaceSystem> {
  const access = input.workspaceId ? await getTeamWorkspaceAccess(input.userId, input.workspaceId) : await getOrCreateDefaultTeamWorkspaceAccess(input.userId);
  assertCanEdit(access.role, "Only team owners, admins, and analysts can update the shared watchlist.");
  const symbols = normalizeWatchlistSymbols(input.symbols);
  if (!symbols.length) return loadTeamWorkspaceSystem(input.userId, access.workspace.id);

  await dbTransaction(async (db) => {
    for (const symbol of symbols) {
      await db.query(
        `
          INSERT INTO team_workspace_watchlist (workspace_id, symbol, added_by_user_id, created_at, updated_at)
          VALUES ($1::uuid, $2, $3::uuid, now(), now())
          ON CONFLICT (workspace_id, symbol)
          DO UPDATE SET added_by_user_id = EXCLUDED.added_by_user_id, updated_at = now()
        `,
        [access.workspace.id, symbol, input.userId],
      );
    }
    await touchWorkspace(db, access.workspace.id);
    await writeTeamAuditLog(db, {
      action: "shared_watchlist.add_symbols",
      actorUserId: input.userId,
      metadata: { symbols },
      request: input.request,
      targetId: access.workspace.id,
      targetType: "team_workspace",
      workspaceId: access.workspace.id,
    });
  });

  return loadTeamWorkspaceSystem(input.userId, access.workspace.id);
}

export async function removeTeamWorkspaceSymbol(input: { request?: Request; symbol: string; userId: string; workspaceId?: string | null }): Promise<TeamWorkspaceSystem> {
  const access = input.workspaceId ? await getTeamWorkspaceAccess(input.userId, input.workspaceId) : await getOrCreateDefaultTeamWorkspaceAccess(input.userId);
  assertCanEdit(access.role, "Only team owners, admins, and analysts can update the shared watchlist.");
  const [symbol] = normalizeWatchlistSymbols([input.symbol]);
  if (!symbol) return loadTeamWorkspaceSystem(input.userId, access.workspace.id);

  await dbTransaction(async (db) => {
    await db.query("DELETE FROM team_workspace_watchlist WHERE workspace_id = $1::uuid AND symbol = $2", [access.workspace.id, symbol]);
    await touchWorkspace(db, access.workspace.id);
    await writeTeamAuditLog(db, {
      action: "shared_watchlist.remove_symbol",
      actorUserId: input.userId,
      metadata: { symbol },
      request: input.request,
      targetId: symbol,
      targetType: "watchlist_symbol",
      workspaceId: access.workspace.id,
    });
  });

  return loadTeamWorkspaceSystem(input.userId, access.workspace.id);
}

export async function createTeamResearchNote(input: {
  body: unknown;
  request?: Request;
  symbol?: unknown;
  title: unknown;
  userId: string;
  visibility?: unknown;
  workspaceId?: string | null;
}): Promise<TeamWorkspaceSystem> {
  const access = input.workspaceId ? await getTeamWorkspaceAccess(input.userId, input.workspaceId) : await getOrCreateDefaultTeamWorkspaceAccess(input.userId);
  assertCanEdit(access.role, "Only team owners, admins, and analysts can add research notes.");
  const title = cleanText(input.title, 120);
  const body = cleanText(input.body, 4_000);
  const [symbol] = normalizeWatchlistSymbols([input.symbol]);
  const visibility = input.visibility === "admins" && (access.role === "owner" || access.role === "admin") ? "admins" : "team";
  if (!title || !body) throw new TeamWorkspaceAccessError("Research notes need a title and body.", 403);

  await dbTransaction(async (db) => {
    const note = await db.query<{ id: string } & QueryResultRow>(
      `
        INSERT INTO team_research_notes (workspace_id, symbol, title, body, visibility, created_by_user_id, created_at, updated_at)
        VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid, now(), now())
        RETURNING id::text
      `,
      [access.workspace.id, symbol ?? null, title, body, visibility, input.userId],
    );
    await touchWorkspace(db, access.workspace.id);
    await writeTeamAuditLog(db, {
      action: "research_note.create",
      actorUserId: input.userId,
      metadata: { symbol: symbol ?? null, title },
      request: input.request,
      targetId: note.rows[0]?.id ?? null,
      targetType: "research_note",
      workspaceId: access.workspace.id,
    });
  });

  return loadTeamWorkspaceSystem(input.userId, access.workspace.id);
}

async function getOrCreateDefaultTeamWorkspaceAccess(userId: string): Promise<WorkspaceAccess> {
  const row = await dbTransaction(async (db) => {
    const workspace = await db.query<WorkspaceRow>(
      `
        INSERT INTO team_workspaces (owner_user_id, name, slug, description, created_at, updated_at)
        VALUES ($1::uuid, $2, $3, $4, now(), now())
        ON CONFLICT (owner_user_id, slug)
        DO UPDATE SET updated_at = team_workspaces.updated_at
        RETURNING id::text, owner_user_id::text, name, slug, description, created_at::text, updated_at::text
      `,
      [userId, DEFAULT_TEAM_NAME, DEFAULT_TEAM_SLUG, "Shared TradeVeto research workspace."],
    );
    const workspaceRow = workspace.rows[0];
    await db.query(
      `
        INSERT INTO team_workspace_members (workspace_id, user_id, role, created_at, updated_at)
        VALUES ($1::uuid, $2::uuid, 'owner', now(), now())
        ON CONFLICT (workspace_id, user_id)
        DO UPDATE SET role = 'owner', updated_at = now()
      `,
      [workspaceRow.id, userId],
    );
    return workspaceRow;
  });
  return { role: "owner", workspace: workspaceFromRow(row) };
}

async function getTeamWorkspaceAccess(userId: string, workspaceId: string): Promise<WorkspaceAccess> {
  const result = await dbQuery<WorkspaceRow>(
    `
      SELECT w.id::text, w.owner_user_id::text, w.name, w.slug, w.description, w.created_at::text, w.updated_at::text, m.role
      FROM team_workspaces w
      JOIN team_workspace_members m ON m.workspace_id = w.id
      WHERE w.id = $1::uuid
        AND m.user_id = $2::uuid
      LIMIT 1
    `,
    [workspaceId, userId],
  );
  const row = result.rows[0];
  if (!row) throw new TeamWorkspaceAccessError("Team workspace unavailable.", 404);
  return { role: normalizeTeamRole(row.role), workspace: workspaceFromRow(row) };
}

async function readTeamWorkspaceMembers(workspaceId: string): Promise<TeamWorkspaceMember[]> {
  const result = await dbQuery<MemberRow>(
    `
      SELECT m.user_id::text, u.email, u.display_name, m.role, m.created_at::text
      FROM team_workspace_members m
      JOIN users u ON u.id = m.user_id
      WHERE m.workspace_id = $1::uuid
      ORDER BY CASE m.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'manager' THEN 3 WHEN 'member' THEN 4 ELSE 5 END, m.created_at ASC
      LIMIT 100
    `,
    [workspaceId],
  );
  return result.rows.map((row) => ({
    createdAt: row.created_at,
    displayName: row.display_name,
    email: row.email,
    role: normalizeTeamRole(row.role),
    userId: row.user_id,
  }));
}

async function readTeamWorkspaceWatchlist(workspaceId: string): Promise<TeamWorkspaceWatchSymbol[]> {
  const result = await dbQuery<WatchSymbolRow>(
    `
      SELECT symbol, note, added_by_user_id::text, created_at::text
      FROM team_workspace_watchlist
      WHERE workspace_id = $1::uuid
      ORDER BY symbol ASC
      LIMIT 250
    `,
    [workspaceId],
  );
  return result.rows.map((row) => ({
    addedByUserId: row.added_by_user_id,
    createdAt: row.created_at,
    note: row.note,
    symbol: row.symbol,
  }));
}

async function readTeamResearchNotes(workspaceId: string): Promise<TeamResearchNote[]> {
  const result = await dbQuery<ResearchNoteRow>(
    `
      SELECT id::text, symbol, title, body, visibility, created_by_user_id::text, created_at::text
      FROM team_research_notes
      WHERE workspace_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT 30
    `,
    [workspaceId],
  );
  return result.rows.map((row) => ({
    body: row.body,
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id,
    id: row.id,
    symbol: row.symbol,
    title: row.title,
    visibility: row.visibility === "admins" ? "admins" : "team",
  }));
}

async function readTeamAuditTrail(workspaceId: string): Promise<TeamAuditEvent[]> {
  const result = await dbQuery<AuditEventRow>(
    `
      SELECT id::text, actor_user_id::text, action, target_type, target_id, metadata, created_at::text
      FROM team_audit_log
      WHERE workspace_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT 40
    `,
    [workspaceId],
  );
  return result.rows.map((row) => ({
    action: row.action,
    actorUserId: row.actor_user_id,
    createdAt: row.created_at,
    id: row.id,
    metadata: row.metadata ?? {},
    targetId: row.target_id,
    targetType: row.target_type,
  }));
}

async function loadOpportunityRows() {
  const adapter = new ScannerDataAdapter();
  const rows = await adapter.getOverviewSignals();
  const symbols = rows.map((row) => row.symbol);
  const [performance, shockPatterns, narratives] = await Promise.all([
    getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
    getShockMovePatternMap(symbols).catch(() => new Map()),
    getNarrativeMap(symbols).catch(() => new Map()),
  ]);
  return buildOpportunitiesPageModel(rows, performance, shockPatterns, narratives).rows;
}

async function writeTeamAuditLog(
  db: DbExecutor,
  input: {
    action: string;
    actorUserId: string;
    metadata?: Record<string, unknown>;
    request?: Request;
    targetId?: string | null;
    targetType: string;
    workspaceId: string;
  },
): Promise<void> {
  const metadata = sanitizeAdminAuditMetadata(input.metadata ?? {});
  await db.query(
    `
      INSERT INTO team_audit_log (workspace_id, actor_user_id, action, target_type, target_id, metadata, ip, user_agent, created_at)
      VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, $7, $8, now())
    `,
    [
      input.workspaceId,
      input.actorUserId,
      cleanText(input.action, 120),
      cleanText(input.targetType, 80),
      input.targetId ? cleanText(input.targetId, 180) : null,
      JSON.stringify(metadata),
      input.request ? requestIp(input.request) : null,
      input.request ? cleanText(input.request.headers.get("user-agent") ?? "", 240) : null,
    ],
  );
  await db.query(
    `
      INSERT INTO enterprise_audit_log (organization_id, workspace_id, actor_user_id, action, target_type, target_id, metadata, ip, user_agent, severity, created_at)
      SELECT w.organization_id, $1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, $7, $8, 'info', now()
      FROM team_workspaces w
      WHERE w.id = $1::uuid
        AND w.organization_id IS NOT NULL
    `,
    [
      input.workspaceId,
      input.actorUserId,
      cleanText(input.action, 120),
      cleanText(input.targetType, 80),
      input.targetId ? cleanText(input.targetId, 180) : null,
      JSON.stringify(metadata),
      input.request ? requestIp(input.request) : null,
      input.request ? cleanText(input.request.headers.get("user-agent") ?? "", 240) : null,
    ],
  ).catch(() => undefined);
}

async function touchWorkspace(db: DbExecutor, workspaceId: string): Promise<void> {
  await db.query("UPDATE team_workspaces SET updated_at = now() WHERE id = $1::uuid", [workspaceId]);
}

function assertCanEdit(role: TeamWorkspaceRole, message: string): void {
  if (role === "owner" || role === "admin" || role === "manager" || role === "member") return;
  throw new TeamWorkspaceAccessError(message, 403);
}

function workspaceFromRow(row: WorkspaceRow): TeamWorkspace {
  return {
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    slug: row.slug,
    updatedAt: row.updated_at,
  };
}

function normalizeTeamRole(value: unknown): TeamWorkspaceRole {
  if (value === "analyst") return "manager";
  return value === "owner" || value === "admin" || value === "manager" || value === "member" || value === "viewer" ? value : "viewer";
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}
