import "server-only";

import { Pool, type QueryResult, type QueryResultRow } from "pg";

type PoolGlobal = typeof globalThis & {
  __marketAlphaDbPool?: Pool;
};

export type DbExecutor = {
  query<Row extends QueryResultRow = QueryResultRow>(text: string, params?: readonly unknown[]): Promise<QueryResult<Row>>;
};

export function getDbPool(): Pool | null {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return null;

  const globalPool = globalThis as PoolGlobal;
  if (!globalPool.__marketAlphaDbPool) {
    globalPool.__marketAlphaDbPool = new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: boundedPoolInteger(process.env.TRADEVETO_DB_POOL_CONNECT_TIMEOUT_MS, 2_000, 250, 30_000),
      idleTimeoutMillis: boundedPoolInteger(process.env.TRADEVETO_DB_POOL_IDLE_TIMEOUT_MS, 30_000, 1_000, 300_000),
      max: boundedPoolInteger(process.env.TRADEVETO_DB_POOL_MAX, 20, 4, 50),
    });
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

export async function dbTransaction<T>(work: (db: DbExecutor) => Promise<T>): Promise<T> {
  const clientPool = getDbPool();
  if (!clientPool) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const client = await clientPool.connect();
  const executor: DbExecutor = {
    query: <Row extends QueryResultRow = QueryResultRow>(text: string, params: readonly unknown[] = []) => client.query<Row>(text, [...params]),
  };

  try {
    await client.query("BEGIN");
    const result = await work(executor);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError: unknown) => {
      console.warn("[db] transaction rollback failed", rollbackError instanceof Error ? rollbackError.message : rollbackError);
    });
    throw error;
  } finally {
    client.release();
  }
}

function boundedPoolInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}
