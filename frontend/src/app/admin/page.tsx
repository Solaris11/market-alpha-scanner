import type { ReactNode } from "react";
import { AdminEmpty, AdminSection, AdminStatCard, StatusBadge } from "@/components/admin/AdminChrome";
import { getAdminDashboardSummary } from "@/lib/server/admin-data";
import { formatAdminDate, statusTone } from "./view-utils";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const summary = await getAdminDashboardSummary();
  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Total users" value={summary.users.total.toLocaleString()} />
        <AdminStatCard label="Premium users" tone="good" value={summary.users.premium.toLocaleString()} />
        <AdminStatCard label="Free users" value={summary.users.free.toLocaleString()} />
        <AdminStatCard label="Admin users" value={summary.users.admins.toLocaleString()} />
        <AdminStatCard label="Active subscriptions" tone="good" value={summary.billing.activeSubscriptions.toLocaleString()} />
        <AdminStatCard label="Cancel scheduled" tone={summary.billing.canceledAtPeriodEnd ? "warn" : "default"} value={summary.billing.canceledAtPeriodEnd.toLocaleString()} />
        <AdminStatCard label="Scanner freshness" meta={summary.scannerFreshness.message} tone={statusTone(summary.scannerFreshness.status)} value={summary.scannerFreshness.status} />
        <AdminStatCard label="Backup status" tone={statusTone(summary.latestBackupStatus)} value={summary.latestBackupStatus} />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <AdminSection title="Latest scanner run">
          {summary.latestScannerRun ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Info label="Status" value={<StatusBadge tone={statusTone(summary.latestScannerRun.status)}>{summary.latestScannerRun.status}</StatusBadge>} />
              <Info label="Completed" value={formatAdminDate(summary.latestScannerRun.completedAt)} />
              <Info label="Symbols scored" value={summary.latestScannerRun.symbolsScored?.toLocaleString() ?? "Unknown"} />
              <Info label="DB signals" value={summary.latestScannerRun.signalCount.toLocaleString()} />
              <Info label="Market regime" value={summary.latestScannerRun.marketRegime ?? "Unknown"} />
              <Info label="Duration" value={summary.latestScannerRun.durationSeconds === null ? "Unknown" : `${Math.round(summary.latestScannerRun.durationSeconds)}s`} />
            </dl>
          ) : (
            <AdminEmpty>No scanner run found.</AdminEmpty>
          )}
        </AdminSection>

        <AdminSection title="Recent monitoring warnings">
          {summary.monitoringWarnings.length ? (
            <div className="space-y-3">
              {summary.monitoringWarnings.map((event) => (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3" key={`${event.eventType}-${event.createdAt}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={statusTone(event.severity)}>{event.severity}</StatusBadge>
                    <span className="text-sm font-semibold text-slate-100">{event.eventType}</span>
                    <span className="text-xs text-slate-500">{formatAdminDate(event.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{event.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmpty>No recent warnings.</AdminEmpty>
          )}
        </AdminSection>
      </div>

      <AdminSection title="Recent billing events">
        {summary.latestBillingEvents.length ? (
          <div className="grid gap-2">
            {summary.latestBillingEvents.map((event) => (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3" key={event.id}>
                <div>
                  <div className="text-sm font-semibold text-slate-100">{event.eventType}</div>
                  <div className="mt-1 text-xs text-slate-500">{event.stripeEventId ?? "No Stripe event id"}</div>
                </div>
                <div className="text-xs text-slate-400">{formatAdminDate(event.createdAt)}</div>
              </div>
            ))}
          </div>
        ) : (
          <AdminEmpty>No billing events found.</AdminEmpty>
        )}
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
