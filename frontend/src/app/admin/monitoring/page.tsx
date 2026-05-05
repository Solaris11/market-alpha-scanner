import Link from "next/link";
import { MonitoringDashboard } from "@/components/admin/MonitoringDashboard";
import { MONITORING_TIME_RANGES, normalizeMonitoringRange } from "@/lib/admin-monitoring-ui";
import { getAdminMonitoringSummary } from "@/lib/server/admin-data";

export const dynamic = "force-dynamic";

export default async function AdminMonitoringPage({ searchParams }: { searchParams?: Promise<{ range?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const range = normalizeMonitoringRange(params.range);
  const monitoring = await getAdminMonitoringSummary(range);
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 shadow-2xl shadow-black/25 backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Observability</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">Real-time production telemetry</h1>
            <p className="mt-1 text-sm leading-6 text-slate-400">DB-backed request, synthetic, system, backup, and monitoring-event trends. No headers, bodies, cookies, or secrets are stored.</p>
          </div>
          <nav className="flex flex-wrap gap-2">
            {MONITORING_TIME_RANGES.map((item) => (
              <Link
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${item === range ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-cyan-300/35"}`}
                href={`/admin/monitoring?range=${item}`}
                key={item}
              >
                {item}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <MonitoringDashboard monitoring={monitoring} range={range} />
    </div>
  );
}
