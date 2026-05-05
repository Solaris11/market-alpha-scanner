import type { ReactNode } from "react";
import { AdminEmpty, AdminSection, AdminStatCard, StatusBadge } from "@/components/admin/AdminChrome";
import { getAdminScannerSummary } from "@/lib/server/admin-data";
import { formatAdminDate, statusTone } from "../view-utils";

export const dynamic = "force-dynamic";

export default async function AdminScannerPage() {
  const scanner = await getAdminScannerSummary();
  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Freshness" meta={scanner.freshness.message} tone={statusTone(scanner.freshness.status)} value={scanner.freshness.status} />
        <AdminStatCard label="DB signal rows" value={scanner.dbSignalCount.toLocaleString()} />
        <AdminStatCard label="CSV fallback" tone={scanner.csvFallbackEnabled ? "warn" : "good"} value={scanner.csvFallbackEnabled ? "enabled" : "disabled"} />
        <AdminStatCard label="Alpaca rows" value={scanner.providerUsage.alpacaCount.toLocaleString()} />
        <AdminStatCard label="Provider fallback" tone={scanner.providerUsage.fallbackCount > 0 ? "warn" : "good"} value={scanner.providerUsage.fallbackCount.toLocaleString()} />
      </section>

      <AdminSection title="Latest scanner run">
        {scanner.latestRun ? (
          <dl className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
            <Info label="Status" value={<StatusBadge tone={statusTone(scanner.latestRun.status)}>{scanner.latestRun.status}</StatusBadge>} />
            <Info label="Completed" value={formatAdminDate(scanner.latestRun.completedAt)} />
            <Info label="Symbols scored" value={scanner.latestRun.symbolsScored?.toLocaleString() ?? "Unknown"} />
            <Info label="DB signals" value={scanner.latestRun.signalCount.toLocaleString()} />
            <Info label="Market regime" value={scanner.latestRun.marketRegime ?? "Unknown"} />
            <Info label="Duration" value={scanner.latestRun.durationSeconds === null ? "Unknown" : `${Math.round(scanner.latestRun.durationSeconds)}s`} />
          </dl>
        ) : (
          <AdminEmpty>No scanner run found.</AdminEmpty>
        )}
      </AdminSection>

      <AdminSection title="DB vs CSV validation">
        {scanner.latestValidation ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={statusTone(scanner.latestValidation.status)}>{scanner.latestValidation.status}</StatusBadge>
              <span className="text-sm font-semibold text-slate-100">{scanner.latestValidation.eventType}</span>
              <span className="text-xs text-slate-500">{formatAdminDate(scanner.latestValidation.createdAt)}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-400">{scanner.latestValidation.message}</p>
          </div>
        ) : (
          <AdminEmpty>No scanner validation event found.</AdminEmpty>
        )}
      </AdminSection>

      <AdminSection title="Market data provider usage" subtitle="Latest scanner run only. Fallback means Alpaca did not provide usable bars for that symbol and yfinance was used instead.">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Providers</div>
            <div className="mt-3 space-y-2">
              {scanner.providerUsage.providers.length ? (
                scanner.providerUsage.providers.map((row) => (
                  <div className="flex items-center justify-between text-sm" key={row.provider}>
                    <span className="font-semibold text-slate-100">{row.provider}</span>
                    <span className="font-mono text-slate-400">{row.count.toLocaleString()}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No provider metadata found.</p>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Fallback reasons</div>
            <div className="mt-3 space-y-2">
              {scanner.providerUsage.topFallbackReasons.length ? (
                scanner.providerUsage.topFallbackReasons.map((row) => (
                  <div className="flex items-center justify-between gap-4 text-sm" key={row.reason}>
                    <span className="min-w-0 truncate font-semibold text-slate-100">{row.reason}</span>
                    <span className="font-mono text-slate-400">{row.count.toLocaleString()}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No fallback usage on latest run.</p>
              )}
            </div>
          </div>
        </div>
      </AdminSection>
    </div>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-1 text-slate-100">{value}</div>
    </div>
  );
}
