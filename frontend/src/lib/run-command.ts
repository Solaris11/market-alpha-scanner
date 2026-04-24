import "server-only";

import { execFile } from "node:child_process";

type RunResult = {
  ok: boolean;
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  error?: string;
};

const DEFAULT_SCANNER_ROOT = "/opt/apps/market-alpha-scanner/app";
const DEFAULT_PYTHON_BIN = "/opt/apps/market-alpha-scanner/venv/bin/python";

function projectRoot() {
  return process.env.SCANNER_ROOT ?? DEFAULT_SCANNER_ROOT;
}

function pythonBin() {
  return process.env.PYTHON_BIN ?? DEFAULT_PYTHON_BIN;
}

export async function runPythonCommand(args: string[]): Promise<RunResult> {
  const python = pythonBin();
  const cwd = projectRoot();
  const command = [python, ...args].join(" ");
  console.log("[scanner-action] command:", command);
  console.log("[scanner-action] cwd:", cwd);

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
          const exitCode = typeof nodeError.code === "number" ? nodeError.code : null;
          const message = nodeError.code === "ENOENT" ? `Python executable was not found: ${python}` : error.message;
          console.log("[scanner-action] exit code:", exitCode ?? nodeError.code ?? "unknown");
          resolve({
            ok: false,
            command,
            cwd,
            stdout,
            stderr,
            exitCode,
            error: message,
          });
          return;
        }

        console.log("[scanner-action] exit code:", 0);
        resolve({
          ok: true,
          command,
          cwd,
          stdout,
          stderr,
          exitCode: 0,
        });
      },
    );
  });
}
