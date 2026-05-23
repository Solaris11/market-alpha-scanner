import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getProductionTrustStatus, type PublicSystemTrustStatus } from "@/lib/server/production-trust-status";
import type { VisibleTrustState } from "@/lib/production-trust-status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description: "TradeVeto public production trust status, provider freshness, degraded systems, incidents, and stale data disclosures.",
  title: "TradeVeto Status",
};

export default async function StatusPage() {
  const status = await getProductionTrustStatus();
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="border-b border-white/10 bg-slate-950">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">TradeVeto Trust Status</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">Production health and data freshness</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Public operational status for system health, provider freshness, stale data, degraded systems, and known incidents. This page does not expose user data, secrets, request bodies, or account-level telemetry.
              </p>
            </div>
            <StatusBadge status={status.overallStatus}>{status.overallStatus}</StatusBadge>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <SummaryTile label="Provider state" status={status.providerFreshness.operationalState} value={status.providerFreshness.operationalState} />
            <SummaryTile label="Scanner freshness" status={status.staleDataState.status} value={status.staleDataState.label} />
            <SummaryTile label="Known incidents" status={status.incidents.length ? "warn" : "ok"} value={String(status.incidents.length)} />
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel title="User-Visible Trust States" subtitle="These are the states users should be able to understand before trusting any intelligence packet.">
            <div className="grid gap-3 sm:grid-cols-2">
              {status.trustStates.map((state) => <TrustStateRow item={state} key={state.key} />)}
            </div>
          </Panel>

          <Panel title="Provider Freshness" subtitle="Latest scanner provider attribution and fallback evidence.">
            <div className="space-y-3">
              <div className={`rounded-xl border p-4 ${toneClass(status.providerFreshness.operationalState)}`}>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Disclosure</div>
                <p className="mt-2 text-sm leading-6 text-slate-200">{status.providerFreshness.freshness}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">{status.delayedFeedDisclosure}</p>
              </div>
              <div className="grid gap-2">
                {status.providerFreshness.providers.length ? status.providerFreshness.providers.map((provider) => (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3" key={provider.provider}>
                    <span className="text-sm font-semibold text-slate-200">{provider.provider}</span>
                    <span className="font-mono text-xs text-slate-400">{provider.count}</span>
                  </div>
                )) : (
                  <div className="rounded-xl border border-amber-300/20 bg-amber-400/[0.06] p-3 text-sm text-amber-100">No provider attribution is visible.</div>
                )}
              </div>
            </div>
          </Panel>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Panel title="System Health" subtitle="Public system status derived from health checks and sanitized monitoring evidence.">
            <div className="grid gap-3">
              {status.degradedSystems.map((system) => <SystemRow item={system} key={system.label} />)}
            </div>
          </Panel>

          <Panel title="Known Incidents" subtitle="Recent warning/error monitoring events from the last 24 hours.">
            {status.incidents.length ? (
              <div className="grid gap-3">
                {status.incidents.map((incident) => (
                  <div className="rounded-xl border border-amber-300/20 bg-amber-400/[0.06] p-4" key={`${incident.eventType}-${incident.createdAt}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={incident.severity}>{incident.severity}</StatusBadge>
                      <span className="text-sm font-semibold text-slate-100">{incident.eventType}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{incident.message}</p>
                    {incident.createdAt ? <p className="mt-2 text-xs text-slate-500">{incident.createdAt}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/[0.06] p-4 text-sm text-emerald-100">No warning/error incidents are visible in the current 24 hour status window.</div>
            )}
          </Panel>
        </section>

        <div className="text-xs leading-5 text-slate-500">Generated at {status.generatedAt}. Public status is informational and can lag rapid production changes.</div>
      </div>
    </main>
  );
}

function Panel({ children, subtitle, title }: { children: ReactNode; subtitle: string; title: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/25">
      <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SummaryTile({ label, status, value }: { label: string; status: string; value: string }) {
  return (
    <div className={`rounded-xl border p-4 ${toneClass(status)}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-50">{value}</div>
    </div>
  );
}

function TrustStateRow({ item }: { item: VisibleTrustState }) {
  return (
    <div className={`rounded-xl border p-4 ${trustStateToneClass(item.status)}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-100">{item.label}</div>
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${trustStateBadgeClass(item.status)}`}>{item.status}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{item.detail}</p>
    </div>
  );
}

function SystemRow({ item }: { item: PublicSystemTrustStatus }) {
  return (
    <div className={`rounded-xl border p-4 ${toneClass(item.status)}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-100">{item.label}</div>
        <StatusBadge status={item.status}>{item.status}</StatusBadge>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{item.detail}</p>
    </div>
  );
}

function StatusBadge({ children, status }: { children: ReactNode; status: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${badgeClass(status)}`}>{children}</span>;
}

function badgeClass(status: string): string {
  const normalized = status.toLowerCase();
  if (["active", "clear", "ok", "operational"].includes(normalized)) return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  if (["degraded", "delayed", "limited", "partial-outage", "stale", "unknown", "warn", "warning"].includes(normalized)) return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  return "border-rose-300/25 bg-rose-400/10 text-rose-100";
}

function toneClass(status: string): string {
  const normalized = status.toLowerCase();
  if (["active", "clear", "ok", "operational"].includes(normalized)) return "border-emerald-300/20 bg-emerald-400/[0.055]";
  if (["degraded", "delayed", "limited", "partial-outage", "stale", "unknown", "warn", "warning"].includes(normalized)) return "border-amber-300/20 bg-amber-400/[0.06]";
  return "border-rose-300/20 bg-rose-400/[0.065]";
}

function trustStateBadgeClass(status: string): string {
  if (status === "clear") return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  if (status === "active") return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

function trustStateToneClass(status: string): string {
  if (status === "clear") return "border-emerald-300/20 bg-emerald-400/[0.055]";
  if (status === "active") return "border-amber-300/20 bg-amber-400/[0.06]";
  return "border-white/10 bg-white/[0.03]";
}
