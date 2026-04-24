"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CommandResult = {
  ok: boolean;
  command: string;
  cwd?: string;
  error?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
};

type Props = {
  endpoint: string;
  label: string;
};

export function RunCommandButton({ endpoint, label }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CommandResult | null>(null);

  async function runCommand() {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(endpoint, { method: "POST" });
      const payload = (await response.json()) as CommandResult;
      setResult({ ...payload, ok: response.ok && payload.ok });
      if (response.ok && payload.ok) {
        router.refresh();
      }
    } catch (error) {
      setResult({
        ok: false,
        command: endpoint,
        error: error instanceof Error ? error.message : "Request failed.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <button
        className="rounded border border-sky-400/40 bg-sky-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-sky-100 hover:bg-sky-400/15 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading}
        onClick={runCommand}
        type="button"
      >
        {loading ? "Running..." : label}
      </button>

      {result ? (
          <div className={`rounded border p-3 text-xs ${result.ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "border-rose-400/30 bg-rose-400/10 text-rose-100"}`}>
            <div className="font-semibold">{result.ok ? "Success" : "Error"}</div>
          <div className="mt-1 text-slate-300">{result.ok ? "Command completed." : result.error}</div>
          {typeof result.exitCode === "number" ? <div className="mt-1 text-slate-400">Exit code: {result.exitCode}</div> : null}
          {result.command ? <div className="mt-1 font-mono text-slate-400">{result.command}</div> : null}
          {result.cwd ? <div className="mt-1 font-mono text-slate-500">cwd: {result.cwd}</div> : null}
          {result.stdout || result.stderr ? (
            <details className="mt-3 text-slate-300">
              <summary className="cursor-pointer text-slate-400">Logs</summary>
              {result.stdout ? <pre className="mt-2 max-h-72 overflow-auto rounded bg-slate-950/70 p-3 whitespace-pre-wrap">{result.stdout}</pre> : null}
              {result.stderr ? <pre className="mt-2 max-h-72 overflow-auto rounded bg-slate-950/70 p-3 whitespace-pre-wrap">{result.stderr}</pre> : null}
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
