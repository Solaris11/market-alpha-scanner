import "server-only";

import { Pool, type QueryResult, type QueryResultRow } from "pg";

type PoolGlobal = typeof globalThis & {
  __marketAlphaDbPool?: Pool;
};

export function getDbPool(): Pool | null {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return null;

  const globalPool = globalThis as PoolGlobal;
  if (!globalPool.__marketAlphaDbPool) {
    globalPool.__marketAlphaDbPool = new Pool({ connectionString: databaseUrl });
  }
  return globalPool.__marketAlphaDbPool;
}

export async function dbQuery<Row extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<Row>> {
  const clientPool = getDbPool();
  if (!clientPool) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return clientPool.query<Row>(text, params);
}
