import { loadEnvFiles, postMonitoringPayload, safeErrorMessage } from "./monitoring-common";

async function main(): Promise<void> {
  loadEnvFiles();
  await postMonitoringPayload({ kind: "cleanup" });
  console.log(JSON.stringify({ ok: true }));
}

main().catch((error: unknown) => {
  console.error(`[monitoring:cleanup] failed: ${safeErrorMessage(error)}`);
  process.exit(1);
});
