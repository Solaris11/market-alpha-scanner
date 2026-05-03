import "server-only";

import type { QueryResultRow } from "pg";
import { dbQuery } from "./db";

export type LegalDocumentType = "terms" | "privacy" | "risk";

export type LegalStatus = {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  riskAccepted: boolean;
  allAccepted: boolean;
};

type LatestLegalDocumentRow = QueryResultRow & {
  type: LegalDocumentType;
  version: string;
};

type AcceptanceRow = QueryResultRow & {
  document_type: LegalDocumentType;
};

const LEGAL_DOCUMENT_TYPES: LegalDocumentType[] = ["terms", "privacy", "risk"];
const EMPTY_LEGAL_STATUS: LegalStatus = {
  allAccepted: false,
  privacyAccepted: false,
  riskAccepted: false,
  termsAccepted: false,
};

export function emptyLegalStatus(): LegalStatus {
  return { ...EMPTY_LEGAL_STATUS };
}

export function isLegalDocumentType(value: unknown): value is LegalDocumentType {
  return LEGAL_DOCUMENT_TYPES.includes(value as LegalDocumentType);
}

export async function getLegalStatus(userId: string | null | undefined): Promise<LegalStatus> {
  if (!userId) return emptyLegalStatus();

  const latestDocuments = await latestLegalDocuments();
  if (latestDocuments.length < LEGAL_DOCUMENT_TYPES.length) return emptyLegalStatus();

  const accepted = await dbQuery<AcceptanceRow>(
    `
      SELECT la.document_type
      FROM legal_acceptances la
      JOIN (
        SELECT DISTINCT ON (type) type, version
        FROM legal_documents
        WHERE type = ANY($2::text[])
        ORDER BY type, created_at DESC, version DESC
      ) latest
        ON latest.type = la.document_type
       AND latest.version = la.document_version
      WHERE la.user_id = $1
    `,
    [userId, LEGAL_DOCUMENT_TYPES],
  );

  return statusFromAcceptedTypes(new Set(accepted.rows.map((row) => row.document_type)));
}

export async function acceptLatestLegalDocument(userId: string, type: LegalDocumentType): Promise<LegalStatus> {
  const document = await latestLegalDocument(type);
  if (!document) {
    throw new Error("Legal document is unavailable.");
  }

  await dbQuery(
    `
      INSERT INTO legal_acceptances (user_id, document_type, document_version, accepted_at)
      VALUES ($1, $2, $3, now())
      ON CONFLICT (user_id, document_type, document_version)
      DO NOTHING
    `,
    [userId, document.type, document.version],
  );

  return getLegalStatus(userId);
}

async function latestLegalDocument(type: LegalDocumentType): Promise<LatestLegalDocumentRow | null> {
  const result = await dbQuery<LatestLegalDocumentRow>(
    `
      SELECT type, version
      FROM legal_documents
      WHERE type = $1
      ORDER BY created_at DESC, version DESC
      LIMIT 1
    `,
    [type],
  );
  return result.rows[0] ?? null;
}

async function latestLegalDocuments(): Promise<LatestLegalDocumentRow[]> {
  const result = await dbQuery<LatestLegalDocumentRow>(
    `
      SELECT DISTINCT ON (type) type, version
      FROM legal_documents
      WHERE type = ANY($1::text[])
      ORDER BY type, created_at DESC, version DESC
    `,
    [LEGAL_DOCUMENT_TYPES],
  );
  return result.rows;
}

function statusFromAcceptedTypes(acceptedTypes: Set<LegalDocumentType>): LegalStatus {
  const termsAccepted = acceptedTypes.has("terms");
  const privacyAccepted = acceptedTypes.has("privacy");
  const riskAccepted = acceptedTypes.has("risk");
  return {
    allAccepted: termsAccepted && privacyAccepted && riskAccepted,
    privacyAccepted,
    riskAccepted,
    termsAccepted,
  };
}
