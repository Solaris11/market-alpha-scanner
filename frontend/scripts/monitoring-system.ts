import { execFile } from "node:child_process";
import { cpus, freemem, totalmem } from "node:os";
import { promisify } from "node:util";
import { loadEnvFiles, postMonitoringPayload, safeErrorMessage } from "./monitoring-common";

type DiskInfo = {
  freeBytes: number | null;
  usedPercent: number | null;
};

const execFileAsync = promisify(execFile);

async function main(): Promise<void> {
  loadEnvFiles();
  const [cpuPercent, disk, backupSizeBytes, scannerOutputSizeBytes, docker] = await Promise.all([
    cpuUsagePercent(),
    diskInfo("/"),
    directorySize("/opt/backups/market-alpha"),
    directorySize("/opt/apps/market-alpha-scanner/runtime/scanner_output"),
    dockerState(),
  ]);
  const memoryPercent = memoryUsagePercent();

  await postMonitoringPayload({
    cpuPercent,
    diskFreeBytes: disk.freeBytes,
    diskPercent: disk.usedPercent,
    kind: "system_metric",
    memoryPercent,
    metadata: {
      backupSizeBytes,
      docker,
      scannerOutputSizeBytes,
    },
  });

  const status = disk.usedPercent !== null && disk.usedPercent > 90 ? "warn" : "ok";
  if (status === "warn") {
    await postMonitoringPayload({
      eventType: "system:disk",
      kind: "monitoring_event",
      message: `Disk usage is ${disk.usedPercent?.toFixed(1)}%.`,
      metadata: { diskFreeBytes: disk.freeBytes, diskPercent: disk.usedPercent },
      severity: "warning",
      status: "warn",
    });
  }

  console.log(
    JSON.stringify(
      {
        backupSizeBytes,
        cpuPercent,
        diskFreeBytes: disk.freeBytes,
        diskPercent: disk.usedPercent,
        dockerContainers: docker.containers,
        memoryPercent,
        scannerOutputSizeBytes,
      },
      null,
      2,
    ),
  );
}

async function cpuUsagePercent(): Promise<number | null> {
  const first = cpuSnapshot();
  await new Promise((resolve) => setTimeout(resolve, 150));
  const second = cpuSnapshot();
  const idle = second.idle - first.idle;
  const total = second.total - first.total;
  if (total <= 0) return null;
  return clampPercent(((total - idle) / total) * 100);
}

function cpuSnapshot(): { idle: number; total: number } {
  return cpus().reduce(
    (accumulator, cpu) => {
      const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
      return {
        idle: accumulator.idle + cpu.times.idle,
        total: accumulator.total + total,
      };
    },
    { idle: 0, total: 0 },
  );
}

function memoryUsagePercent(): number | null {
  const total = totalmem();
  if (total <= 0) return null;
  return clampPercent(((total - freemem()) / total) * 100);
}

async function diskInfo(path: string): Promise<DiskInfo> {
  try {
    const { stdout } = await execFileAsync("df", ["-Pk", path]);
    const line = stdout.trim().split(/\r?\n/)[1];
    if (!line) return { freeBytes: null, usedPercent: null };
    const parts = line.trim().split(/\s+/);
    const availableKb = Number(parts[3]);
    const usedPercent = Number(String(parts[4] ?? "").replace("%", ""));
    return {
      freeBytes: Number.isFinite(availableKb) ? availableKb * 1024 : null,
      usedPercent: Number.isFinite(usedPercent) ? clampPercent(usedPercent) : null,
    };
  } catch {
    return { freeBytes: null, usedPercent: null };
  }
}

async function directorySize(path: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("du", ["-sb", path]);
    const value = Number(stdout.trim().split(/\s+/)[0]);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

async function dockerState(): Promise<Record<string, unknown>> {
  try {
    const { stdout } = await execFileAsync("docker", ["ps", "--format", "{{.Names}}|{{.Status}}"]);
    const containers = stdout
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((line) => line.includes("market-alpha"))
      .map((line) => {
        const [name, status] = line.split("|");
        return { name, status };
      });
    return { containers };
  } catch (error) {
    return { error: safeErrorMessage(error) };
  }
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

main().catch((error: unknown) => {
  console.error(`[monitoring:system] failed: ${safeErrorMessage(error)}`);
  process.exit(1);
});
