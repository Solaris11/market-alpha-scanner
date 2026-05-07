import Link from "next/link";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import { ANALYTICS_TIME_RANGES, normalizeAnalyticsRange } from "@/lib/analytics-policy";
import { getAnalyticsSummary } from "@/lib/server/analytics";
import { requireAdminPageUser } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

const RANGE_LABELS: Record<string, string> = {
  "30d": "30D",
  "7d": "7D",
  "90d": "90D",
  today: "Today",
};

export default async function AdminAnalyticsPage({ searchParams }: { searchParams?: Promise<{ range?: string }> }) {
  await requireAdminPageUser();
  const params = searchParams ? await searchParams : {};
  const range = normalizeAnalyticsRange(params.range);
  const analytics = await getAnalyticsSummary(range);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 shadow-2xl shadow-black/25 backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Visitor Insights</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">Page views, retention, and beta learning</h1>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-400">
              First-party, privacy-conscious analytics for closed beta. No raw IPs, full user agents, passwords, secrets, financial account data, or session tokens are stored.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2">
            {ANALYTICS_TIME_RANGES.map((item) => (
              <Link
                className={`inline-flex min-h-9 items-center rounded-full border px-3 py-2 text-xs font-semibold transition ${item === range ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-cyan-300/35"}`}
                href={`/admin/analytics?range=${item}`}
                key={item}
              >
                {RANGE_LABELS[item]}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <AnalyticsDashboard analytics={analytics} />
    </div>
  );
}
