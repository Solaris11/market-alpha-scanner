import "server-only";

import { execFile } from "node:child_process";
import path from "node:path";

type RunResult = {
  ok: boolean;
  command: string;
  message: string;
  stdout: string;
  stderr: string;
  code: number | null;
};

function projectRoot() {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), "..");
}

export function commandText(args: string[]) {
  return ["python", ...args].join(" ");
}

export async function runPythonCommand(args: string[]): Promise<RunResult> {
  const python = process.env.SCANNER_PYTHON_BIN ?? "python";
  const command = [python, ...args].join(" ");

  return new Promise((resolve) => {
    execFile(
      python,
      args,
      {
        cwd: projectRoot(),
        timeout: 600_000,
        maxBuffer: 20 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          const nodeError = error as NodeJS.ErrnoException & { code?: string | number | null };
          const code = typeof nodeError.code === "number" ? nodeError.code : null;
          const message = nodeError.code === "ENOENT" ? "Python executable was not found for this Next.js process." : error.message;
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
          message: "Command completed successfully.",
          stdout,
          stderr,
          code: 0,
        });
      },
    );
  });
}
