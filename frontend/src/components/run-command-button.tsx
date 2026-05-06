"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { csrfFetch } from "@/lib/client/csrf-fetch";

type CommandResult = {
  lastRunAt?: string | null;
  ok: boolean;
  message?: string;
  startedAt?: string | null;
  status?: "already_running" | "completed" | "failed" | "unavailable";
  cwd?: string;
  error?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
};

type Props = {
  endpoint: string;
  label: string;
  diagnostic?: boolean;
};

export function RunCommandButton({ endpoint, label, diagnostic = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CommandResult | null>(null);
  const serverRunning = result?.status === "already_running";

  async function runCommand() {
    setLoading(true);
    setResult(null);

    try {
      const response = await csrfFetch(endpoint, { method: "POST" });
      const payload = (await response.json()) as CommandResult;
      setResult({ ...payload, ok: response.ok && payload.ok });
      if (response.ok && payload.ok && payload.status !== "already_running") {
        router.refresh();
      }
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : "Request failed.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100 transition-all duration-200 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading || serverRunning}
        onClick={runCommand}
        type="button"
      >
        {loading || serverRunning ? "Job Running..." : label}
      </button>

      {result ? (
        <div className={`rounded border p-3 text-xs ${result.status === "already_running" ? "border-amber-300/30 bg-amber-400/10 text-amber-100" : result.ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "border-rose-400/30 bg-rose-400/10 text-rose-100"}`}>
          <div className="font-semibold">{result.status === "already_running" ? "Already running" : result.status === "unavailable" ? "Runner unavailable" : result.ok ? "Success" : "Error"}</div>
          <div className="mt-1 text-slate-300">{result.message ?? result.error ?? (result.ok ? "Refresh completed." : "Request failed.")}</div>
          {result.startedAt ? <div className="mt-2 text-slate-400">Started: {new Date(result.startedAt).toLocaleString()}</div> : null}
          {result.lastRunAt ? <div className="mt-1 text-slate-400">Last completed run: {new Date(result.lastRunAt).toLocaleString()}</div> : null}
          {diagnostic && (result.stdout || result.stderr) ? (
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
