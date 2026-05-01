import "server-only";

import { execFile } from "node:child_process";

type RunResult = {
  ok: boolean;
  message: string;
};

const DEFAULT_SCANNER_ROOT = "/opt/apps/market-alpha-scanner/app";
const DEFAULT_PYTHON_BIN = "/opt/apps/market-alpha-scanner/venv/bin/python";

function projectRoot() {
  return process.env.SCANNER_ROOT ?? DEFAULT_SCANNER_ROOT;
}

function pythonBin() {
  return process.env.PYTHON_BIN ?? DEFAULT_PYTHON_BIN;
}

export async function runPythonCommand(
  args: string[],
  messages: { failure?: string; success?: string } = {},
): Promise<RunResult> {
  const python = pythonBin();
  const cwd = projectRoot();
  const successMessage = messages.success ?? "Operation completed.";
  const failureMessage = messages.failure ?? "Operation failed.";
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
      (error, stdout, stderr) => {
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
            ok: false,
            message: failureMessage,
          });
          return;
        }

        console.log("[scanner-action] exit code:", 0);
        resolve({
          ok: true,
          message: successMessage,
        });
      },
    );
  });
}
