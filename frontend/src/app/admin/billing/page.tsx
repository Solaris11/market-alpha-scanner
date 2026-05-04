import { AdminEmpty, AdminSection, AdminTable, StatusBadge } from "@/components/admin/AdminChrome";
import { listAdminBilling } from "@/lib/server/admin-data";
import { formatAdminDate, statusTone } from "../view-utils";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  const billing = await listAdminBilling();
  return (
    <div className="space-y-5">
      <AdminSection title="Subscriptions" subtitle="Stripe-synced billing state. Stripe remains the source of truth; this page does not grant manual premium access.">
        {billing.subscriptions.length ? (
          <AdminTable>
            <table className="min-w-[1200px] w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-[10px] uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">User</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Plan</th>
                  <th className="px-3 py-3">Period end</th>
                  <th className="px-3 py-3">Cancel scheduled</th>
                  <th className="px-3 py-3">Stripe customer</th>
                  <th className="px-3 py-3">Stripe subscription</th>
                  <th className="px-3 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {billing.subscriptions.map((item) => (
                  <tr className="text-slate-300" key={item.userId}>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-100">{item.email ?? "Deleted user"}</div>
                      <div className="text-xs text-slate-500">{item.userId}</div>
                    </td>
                    <td className="px-3 py-3"><StatusBadge tone={statusTone(item.status)}>{item.status ?? "unknown"}</StatusBadge></td>
                    <td className="px-3 py-3">{item.plan ?? "unknown"}</td>
                    <td className="px-3 py-3">{formatAdminDate(item.currentPeriodEnd)}</td>
                    <td className="px-3 py-3">{item.cancelAtPeriodEnd ? <StatusBadge tone="warn">yes</StatusBadge> : "no"}</td>
                    <td className="px-3 py-3 font-mono text-xs">{item.stripeCustomerId ?? "not linked"}</td>
                    <td className="px-3 py-3 font-mono text-xs">{item.stripeSubscriptionId ?? "not linked"}</td>
                    <td className="px-3 py-3">{formatAdminDate(item.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTable>
        ) : (
          <AdminEmpty>No subscriptions found.</AdminEmpty>
        )}
      </AdminSection>

      <AdminSection title="Recent billing events">
        {billing.events.length ? (
          <div className="grid gap-2">
            {billing.events.map((event) => (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3" key={event.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-100">{event.eventType}</div>
                  <div className="text-xs text-slate-500">{formatAdminDate(event.createdAt)}</div>
                </div>
                <div className="mt-1 font-mono text-xs text-slate-500">{event.stripeEventId ?? "No Stripe event id"}</div>
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
