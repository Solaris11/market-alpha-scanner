import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type QueryResult, type QueryResultRow } from "pg";
import Stripe from "stripe";
import { reconcileStripeSubscriptions, type RateLimitedDb, type StripeSubscriptionForReconciliation } from "../src/lib/stripe-reconciliation";

type ScriptArgs = {
  dryRun: boolean;
};

type DbPoolExecutor = RateLimitedDb & {
  close(): Promise<void>;
};

async function main(): Promise<void> {
  loadEnvFiles();
  const args = parseArgs(process.argv.slice(2));
  const db = createDbExecutor(requiredEnv("DATABASE_URL"));
  const stripeClient = createStripeFetcher(requiredEnv("STRIPE_SECRET_KEY"));

  try {
    const result = await reconcileStripeSubscriptions({
      db,
      dryRun: args.dryRun,
      stripe: stripeClient,
    });
    console.log(
      JSON.stringify(
        {
          checked: result.checked,
          dryRun: args.dryRun,
          errors: result.errors,
          mismatchesFound: result.mismatches.length,
          skipped: result.skipped,
          updated: result.updated,
        },
        null,
        2,
      ),
    );
    if (result.errors > 0) {
      process.exitCode = 2;
    }
  } finally {
    await db.close();
  }
}

function createDbExecutor(databaseUrl: string): DbPoolExecutor {
  const pool = new Pool({ connectionString: databaseUrl });
  return {
    close: () => pool.end(),
    query: <Row extends QueryResultRow = QueryResultRow>(text: string, params: readonly unknown[] = []): Promise<QueryResult<Row>> => pool.query<Row>(text, [...params]),
  };
}

function createStripeFetcher(secretKey: string) {
  const client = new Stripe(secretKey);
  return {
    listSubscriptionsByCustomer: async (customerId: string): Promise<StripeSubscriptionForReconciliation[]> => {
      const response = await client.subscriptions.list({ customer: customerId, limit: 10, status: "all" });
      return response.data as StripeSubscriptionForReconciliation[];
    },
    retrieveSubscription: async (subscriptionId: string): Promise<StripeSubscriptionForReconciliation> => {
      return (await client.subscriptions.retrieve(subscriptionId)) as StripeSubscriptionForReconciliation;
    },
  };
}

function parseArgs(args: string[]): ScriptArgs {
  return {
    dryRun: args.includes("--dry-run"),
  };
}

function loadEnvFiles(): void {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "..", ".env"), resolve(scriptDir, "..", ".env")];
  for (const filePath of candidates) {
    loadEnvFile(filePath);
  }
}

function loadEnvFile(filePath: string): void {
  let raw = "";
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key]) continue;
    process.env[key] = unquoteEnvValue(trimmed.slice(equalsIndex + 1).trim());
  }
}

function unquoteEnvValue(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown reconciliation failure.";
  console.error(`[stripe:reconcile] failed: ${message}`);
  process.exit(1);
});
