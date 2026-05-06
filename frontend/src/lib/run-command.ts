import "server-only";

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { dbQuery } from "@/lib/server/db";
import { scannerCommandStatusFromOutput, type ScannerCommandStatus } from "@/lib/security/scanner-command-policy";

type RunResult = {
  lastRunAt?: string | null;
  ok: boolean;
  message: string;
  startedAt?: string | null;
  status: ScannerCommandStatus;
};

const DEFAULT_SCANNER_ROOT = "/opt/apps/market-alpha-scanner/app";
const DEFAULT_PYTHON_BIN = "/opt/apps/market-alpha-scanner/venv/bin/python";
const DEFAULT_SCANNER_OUTPUT_DIR = "/app/scanner_output";
const LOCK_STALE_AFTER_MS = 30 * 60 * 1000;

function projectRoot() {
  return process.env.SCANNER_ROOT ?? DEFAULT_SCANNER_ROOT;
}

function pythonBin() {
  return process.env.PYTHON_BIN ?? DEFAULT_PYTHON_BIN;
}

export async function runPythonCommand(
  args: string[],
  messages: { failure?: string; success?: string; unavailable?: string } = {},
): Promise<RunResult> {
  const python = pythonBin();
  const cwd = projectRoot();
  const successMessage = messages.success ?? "Operation completed.";
  const failureMessage = messages.failure ?? "Operation failed.";
  const unavailableMessage = messages.unavailable ?? "Scanner runner is not available in this API runtime. Use the production scanner job; data will update after the next scheduled run.";
  const lastRunAt = await latestScannerRunCompletedAt();
  const activeLock = await readActiveScannerLock();
  if (activeLock.active) {
    return {
      lastRunAt,
      message: "Scanner is already running. Data will update when complete.",
      ok: true,
      startedAt: activeLock.startedAt,
      status: "already_running",
    };
  }

  const runnerAvailable = await canAccessRunner(python, cwd);
  if (!runnerAvailable) {
    console.warn("[scanner-action] runner unavailable", {
      cwd,
      python,
      requested: args[0] ?? "unknown",
    });
    return {
      lastRunAt,
      ok: false,
      message: unavailableMessage,
      status: "unavailable",
    };
  }

  console.log("[scanner-action] starting job:", args.join(" "));

  return new Promise((resolve) => {
    execFile(
      python,
      args,
      {
        cwd,
        timeout: 600_000,
        maxBuffer: 20 * 1024 * 1024,
      },
      async (error, stdout, stderr) => {
        const outputStatus = scannerCommandStatusFromOutput(stdout, stderr);
        if (outputStatus === "already_running") {
          const latest = await latestScannerRunCompletedAt();
          const lock = await readActiveScannerLock();
          resolve({
            lastRunAt: latest,
            message: "Scanner is already running. Data will update when complete.",
            ok: true,
            startedAt: lock.startedAt,
            status: "already_running",
          });
          return;
        }

        if (error) {
          const nodeError = error as NodeJS.ErrnoException & { code?: string | number | null };
          const exitCode = typeof nodeError.code === "number" ? nodeError.code : null;
          console.warn("[scanner-action] failed", {
            code: nodeError.code ?? "unknown",
            exitCode,
            stderr: stderr ? stderr.slice(0, 500) : "",
            stdout: stdout ? stdout.slice(0, 500) : "",
          });
          resolve({
            lastRunAt,
            ok: false,
            message: failureMessage,
            status: "failed",
          });
          return;
        }

        console.log("[scanner-action] exit code:", 0);
        const latest = await latestScannerRunCompletedAt();
        resolve({
          lastRunAt: latest,
          ok: true,
          message: successMessage,
          status: "completed",
        });
      },
    );
  });
}

async function latestScannerRunCompletedAt(): Promise<string | null> {
  try {
    const result = await dbQuery<{ completed_at: string | null }>(
      "SELECT completed_at::text FROM scan_runs WHERE completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1",
    );
    return result.rows[0]?.completed_at ?? null;
  } catch {
    return null;
  }
}

async function readActiveScannerLock(): Promise<{ active: boolean; startedAt: string | null }> {
  const lockPath = path.join(process.env.SCANNER_OUTPUT_DIR ?? DEFAULT_SCANNER_OUTPUT_DIR, "run.lock");
  try {
    const raw = await fs.readFile(lockPath, "utf8");
    const payload = JSON.parse(raw) as { timestamp?: unknown };
    const startedAt = typeof payload.timestamp === "string" ? payload.timestamp : null;
    if (!startedAt) return { active: false, startedAt: null };
    const parsed = Date.parse(startedAt);
    if (!Number.isFinite(parsed)) return { active: false, startedAt: null };
    return { active: Date.now() - parsed < LOCK_STALE_AFTER_MS, startedAt };
  } catch {
    return { active: false, startedAt: null };
  }
}

async function canAccessRunner(python: string, cwd: string): Promise<boolean> {
  try {
    await fs.access(python);
    await fs.access(cwd);
    return true;
  } catch {
    return false;
  }
}
