import "server-only";

import type { QueryResultRow } from "pg";
import { cleanSupportText, normalizeSupportCategory, normalizeSupportPriority, normalizeSupportStatus, userCanAccessTicket, type SupportTicketCategory, type SupportTicketPriority, type SupportTicketStatus } from "@/lib/security/support-policy";
import { normalizeAuthEmail, type AuthUser } from "./auth";
import { dbQuery, dbTransaction } from "./db";
import { requestIp } from "./request-security";

export type SupportTicket = {
  category: SupportTicketCategory;
  closedAt: string | null;
  createdAt: string;
  email: string;
  id: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  subject: string;
  updatedAt: string;
  userId: string | null;
};

export type SupportTicketMessage = {
  createdAt: string;
  id: string;
  message: string;
  senderType: "user" | "admin" | "system";
  senderUserId: string | null;
};

export type SupportTicketDetail = SupportTicket & {
  messages: SupportTicketMessage[];
};

type TicketRow = QueryResultRow & {
  category: string;
  closed_at: string | null;
  created_at: string;
  email: string;
  id: string;
  priority: string;
  status: string;
  subject: string;
  updated_at: string;
  user_id: string | null;
};

type MessageRow = QueryResultRow & {
  created_at: string;
  id: string;
  message: string;
  sender_type: "user" | "admin" | "system";
  sender_user_id: string | null;
};

export function normalizeSupportEmail(value: unknown): string | null {
  return normalizeAuthEmail(value);
}

export async function createSupportTicket(input: {
  category?: unknown;
  email?: unknown;
  message?: unknown;
  subject?: unknown;
  user: AuthUser | null;
}): Promise<SupportTicketDetail> {
  const email = input.user?.email ?? normalizeSupportEmail(input.email);
  const subject = cleanSupportText(input.subject, 180);
  const message = cleanSupportText(input.message, 4000);
  const category = normalizeSupportCategory(input.category);
  if (!email || subject.length < 4 || message.length < 10) {
    throw new Error("invalid_ticket");
  }

  const ticketId = await dbTransaction(async (db) => {
    const ticket = await db.query<{ id: string }>(
      `
        INSERT INTO support_tickets (user_id, email, subject, category, status, priority, created_at, updated_at)
        VALUES ($1::uuid, $2, $3, $4, 'open', 'normal', now(), now())
        RETURNING id::text
      `,
      [input.user?.id ?? null, email, subject, category],
    );
    const id = ticket.rows[0].id;
    await db.query(
      `
        INSERT INTO support_ticket_messages (ticket_id, sender_type, sender_user_id, message, created_at)
        VALUES ($1::uuid, 'user', $2::uuid, $3, now())
      `,
      [id, input.user?.id ?? null, message],
    );
    return id;
  });
  return getSupportTicketForRequester(ticketId, input.user?.id ?? null, email);
}

export async function listSupportTicketsForUser(userId: string): Promise<SupportTicket[]> {
  const result = await dbQuery<TicketRow>(
    `
      SELECT id::text, user_id::text, email, subject, category, status, priority, created_at::text, updated_at::text, closed_at::text
      FROM support_tickets
      WHERE user_id = $1::uuid
      ORDER BY updated_at DESC
      LIMIT 50
    `,
    [userId],
  );
  return result.rows.map(ticketFromRow);
}

export async function getSupportTicketForUser(ticketId: string, userId: string): Promise<SupportTicketDetail | null> {
  const detail = await getSupportTicketDetail(ticketId);
  if (!detail || !userCanAccessTicket(detail.userId, userId)) return null;
  return detail;
}

export async function replyToSupportTicket(input: { message?: unknown; ticketId: string; user: AuthUser }): Promise<SupportTicketDetail> {
  const detail = await getSupportTicketForUser(input.ticketId, input.user.id);
  if (!detail) throw new Error("ticket_not_found");
  const message = cleanSupportText(input.message, 4000);
  if (message.length < 2) throw new Error("invalid_message");
  await dbTransaction(async (db) => {
    await db.query(
      `
        INSERT INTO support_ticket_messages (ticket_id, sender_type, sender_user_id, message, created_at)
        VALUES ($1::uuid, 'user', $2::uuid, $3, now())
      `,
      [input.ticketId, input.user.id, message],
    );
    await db.query("UPDATE support_tickets SET status = 'open', updated_at = now(), closed_at = NULL WHERE id = $1::uuid", [input.ticketId]);
  });
  const updated = await getSupportTicketForUser(input.ticketId, input.user.id);
  if (!updated) throw new Error("ticket_not_found");
  return updated;
}

export async function listAdminSupportTickets(input: { status?: string | null } = {}): Promise<SupportTicket[]> {
  const status = input.status ? normalizeSupportStatus(input.status) : null;
  const result = await dbQuery<TicketRow>(
    `
      SELECT id::text, user_id::text, email, subject, category, status, priority, created_at::text, updated_at::text, closed_at::text
      FROM support_tickets
      WHERE ($1::text IS NULL OR status = $1)
      ORDER BY updated_at DESC
      LIMIT 100
    `,
    [status],
  );
  return result.rows.map(ticketFromRow);
}

export async function getAdminSupportTicket(ticketId: string): Promise<SupportTicketDetail | null> {
  return getSupportTicketDetail(ticketId);
}

export async function adminReplyToSupportTicket(input: { admin: AuthUser; message?: unknown; request: Request; ticketId: string }): Promise<SupportTicketDetail> {
  const message = cleanSupportText(input.message, 4000);
  if (message.length < 2) throw new Error("invalid_message");
  await dbTransaction(async (db) => {
    await db.query(
      `
        INSERT INTO support_ticket_messages (ticket_id, sender_type, sender_user_id, message, created_at)
        VALUES ($1::uuid, 'admin', $2::uuid, $3, now())
      `,
      [input.ticketId, input.admin.id, message],
    );
    await db.query("UPDATE support_tickets SET status = 'pending', updated_at = now() WHERE id = $1::uuid", [input.ticketId]);
    await db.query(
      `
        INSERT INTO admin_audit_log (admin_user_id, action, target_type, target_id, metadata, ip, user_agent, created_at)
        VALUES ($1::uuid, 'support.ticket.reply', 'support_ticket', $2, '{}'::jsonb, $3, $4, now())
      `,
      [input.admin.id, input.ticketId, requestIp(input.request), input.request.headers.get("user-agent")?.slice(0, 240) ?? null],
    );
  });
  const updated = await getAdminSupportTicket(input.ticketId);
  if (!updated) throw new Error("ticket_not_found");
  return updated;
}

export async function adminUpdateSupportTicketState(input: {
  admin: AuthUser;
  priority?: unknown;
  request: Request;
  status?: unknown;
  ticketId: string;
}): Promise<SupportTicketDetail> {
  const status = normalizeSupportStatus(input.status);
  const priority = normalizeSupportPriority(input.priority);
  await dbTransaction(async (db) => {
    const result = await db.query<{ id: string }>("SELECT id::text FROM support_tickets WHERE id = $1::uuid LIMIT 1", [input.ticketId]);
    if (!result.rows[0]) throw new Error("ticket_not_found");
    await db.query(
      `
        UPDATE support_tickets
        SET status = $2,
            priority = $3,
            closed_at = CASE WHEN $2 IN ('resolved', 'closed') THEN COALESCE(closed_at, now()) ELSE NULL END,
            updated_at = now()
        WHERE id = $1::uuid
      `,
      [input.ticketId, status, priority],
    );
    await db.query(
      `
        INSERT INTO admin_audit_log (admin_user_id, action, target_type, target_id, metadata, ip, user_agent, created_at)
        VALUES ($1::uuid, 'support.ticket.status', 'support_ticket', $2, $3::jsonb, $4, $5, now())
      `,
      [input.admin.id, input.ticketId, JSON.stringify({ priority, status }), requestIp(input.request), input.request.headers.get("user-agent")?.slice(0, 240) ?? null],
    );
  });
  const updated = await getAdminSupportTicket(input.ticketId);
  if (!updated) throw new Error("ticket_not_found");
  return updated;
}

async function getSupportTicketForRequester(ticketId: string, userId: string | null, email: string): Promise<SupportTicketDetail> {
  const detail = await getSupportTicketDetail(ticketId);
  if (!detail || (userId ? detail.userId !== userId : detail.email.toLowerCase() !== email.toLowerCase())) throw new Error("ticket_not_found");
  return detail;
}

async function getSupportTicketDetail(ticketId: string): Promise<SupportTicketDetail | null> {
  const ticket = await dbQuery<TicketRow>(
    `
      SELECT id::text, user_id::text, email, subject, category, status, priority, created_at::text, updated_at::text, closed_at::text
      FROM support_tickets
      WHERE id = $1::uuid
      LIMIT 1
    `,
    [ticketId],
  );
  const row = ticket.rows[0];
  if (!row) return null;
  const messages = await dbQuery<MessageRow>(
    `
      SELECT id::text, sender_type, sender_user_id::text, message, created_at::text
      FROM support_ticket_messages
      WHERE ticket_id = $1::uuid
      ORDER BY created_at ASC
    `,
    [ticketId],
  );
  return { ...ticketFromRow(row), messages: messages.rows.map(messageFromRow) };
}

function ticketFromRow(row: TicketRow): SupportTicket {
  return {
    category: normalizeSupportCategory(row.category),
    closedAt: row.closed_at,
    createdAt: row.created_at,
    email: row.email,
    id: row.id,
    priority: normalizeSupportPriority(row.priority),
    status: normalizeSupportStatus(row.status),
    subject: row.subject,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

function messageFromRow(row: MessageRow): SupportTicketMessage {
  return {
    createdAt: row.created_at,
    id: row.id,
    message: row.message,
    senderType: row.sender_type,
    senderUserId: row.sender_user_id,
  };
}
