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
