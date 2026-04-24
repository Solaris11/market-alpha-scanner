import "server-only";

import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type RunResult = {
  ok: boolean;
  command: string;
  message: string;
  stdout: string;
  stderr: string;
  code: number | null;
};

const DEFAULT_SCANNER_ROOT = "/opt/apps/market-alpha-scanner/app";
const DEFAULT_PYTHON_BIN = "/opt/apps/market-alpha-scanner/venv/bin/python";

function projectRoot() {
  if (process.env.SCANNER_ROOT) return process.env.SCANNER_ROOT;
  if (fs.existsSync(DEFAULT_SCANNER_ROOT)) return DEFAULT_SCANNER_ROOT;
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), "..");
}

function pythonBin() {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  if (fs.existsSync(DEFAULT_PYTHON_BIN)) return DEFAULT_PYTHON_BIN;
  return process.env.SCANNER_PYTHON_BIN ?? "python3";
}

export async function runPythonCommand(args: string[]): Promise<RunResult> {
  const python = pythonBin();
  const cwd = projectRoot();
  const command = [python, ...args].join(" ");

  return new Promise((resolve) => {
    execFile(
      python,
      args,
      {
        cwd,
        timeout: 600_000,
        maxBuffer: 20 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          const nodeError = error as NodeJS.ErrnoException & { code?: string | number | null };
          const code = typeof nodeError.code === "number" ? nodeError.code : null;
          const message =
            nodeError.code === "ENOENT"
              ? `Python executable was not found: ${python}`
              : `Command failed in ${cwd}: ${error.message}`;
          resolve({
            ok: false,
            command,
            message,
            stdout,
            stderr,
            code,
          });
          return;
        }

        resolve({
          ok: true,
          command,
          message: `Command completed successfully in ${cwd}.`,
          stdout,
          stderr,
          code: 0,
        });
      },
    );
  });
}
