import { DisableAlertRuleButton } from "@/components/admin/AdminActions";
import { AdminEmpty, AdminSection, AdminStatCard, AdminTable } from "@/components/admin/AdminChrome";
import { getAdminAlertSummary } from "@/lib/server/admin-data";
import { formatAdminDate } from "../view-utils";

export const dynamic = "force-dynamic";

export default async function AdminAlertsPage() {
  const alerts = await getAdminAlertSummary();
  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Alert rules" value={alerts.totalRules.toLocaleString()} />
        <AdminStatCard label="Active rules" tone={alerts.activeRules ? "good" : "default"} value={alerts.activeRules.toLocaleString()} />
      </section>

      <AdminSection title="Alerts by user">
        {alerts.byUser.length ? (
          <AdminTable>
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-[10px] uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">User</th>
                  <th className="px-3 py-3">Total</th>
                  <th className="px-3 py-3">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {alerts.byUser.map((row) => (
                  <tr className="text-slate-300" key={row.userId}>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-100">{row.email ?? "Unknown user"}</div>
                      <div className="text-xs text-slate-500">{row.userId}</div>
                    </td>
                    <td className="px-3 py-3">{row.total.toLocaleString()}</td>
                    <td className="px-3 py-3">{row.active.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTable>
        ) : (
          <AdminEmpty>No alert rules found.</AdminEmpty>
        )}
      </AdminSection>

      <AdminSection title="Recently triggered rules">
        {alerts.recentlyTriggered.length ? (
          <AdminTable>
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-[10px] uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">Rule</th>
                  <th className="px-3 py-3">Symbol</th>
                  <th className="px-3 py-3">Last triggered</th>
                  <th className="px-3 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {alerts.recentlyTriggered.map((row) => (
                  <tr className="text-slate-300" key={row.ruleId}>
                    <td className="px-3 py-3 font-mono text-xs">{row.ruleId}</td>
                    <td className="px-3 py-3">{row.symbol ?? "Unknown"}</td>
                    <td className="px-3 py-3">{formatAdminDate(row.lastTriggeredAt)}</td>
                    <td className="px-3 py-3"><DisableAlertRuleButton ruleId={row.ruleId} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTable>
        ) : (
          <AdminEmpty>No triggered alert state found.</AdminEmpty>
        )}
      </AdminSection>
    </div>
  );
}
