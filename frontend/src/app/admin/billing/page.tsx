import { AdminEmpty, AdminSection, AdminStatCard, AdminTable, StatusBadge } from "@/components/admin/AdminChrome";
import { listAdminBilling } from "@/lib/server/admin-data";
import { formatAdminDate, statusTone } from "../view-utils";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  const billing = await listAdminBilling();
  const revenue = billing.revenue;
  return (
    <div className="space-y-5">
      <AdminSection title="Revenue validation" subtitle="Live monetization certification. This panel reads first-party analytics, live-mode Stripe state, billing lifecycle events, and explicit campaign metadata only.">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div>
            <div className="text-sm font-semibold text-slate-100">Phase 34.4 revenue readiness</div>
            <div className="mt-1 text-xs leading-5 text-slate-400">Lookback: {revenue.lookbackDays} days. Synthetic revenue data: none created.</div>
          </div>
          <StatusBadge tone={revenue.status === "ready" ? "good" : revenue.status === "strong_partial" ? "warn" : "bad"}>{revenue.status.replace("_", " ")}</StatusBadge>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <AdminStatCard label="Visitors" value={formatCount(revenue.funnel.visitorActors)} meta={`${formatPct(revenue.rates.visitorToSignupPct)} visitor to signup`} />
          <AdminStatCard label="Signups" value={formatCount(revenue.funnel.signups)} meta={`${formatPct(revenue.rates.signupToActivatedPct)} signup to activated`} />
          <AdminStatCard label="Activated" value={formatCount(revenue.funnel.activatedUsers)} meta="First useful action, onboarding, or activation telemetry" />
          <AdminStatCard label="Trials" value={formatCount(revenue.funnel.trialUsers)} meta={`${formatPct(revenue.rates.trialToPaidPct)} trial to paid`} tone={revenue.gates.trialToPaidEvidence ? "good" : "warn"} />
          <AdminStatCard label="Paid" value={formatCount(revenue.funnel.paidUsers)} meta={`${formatPct(revenue.rates.paidRetentionPct)} paid retained`} tone={revenue.gates.firstPaidCustomers ? "good" : "bad"} />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <AdminStatCard label="MRR" value={formatMoney(revenue.economics.mrrCents)} meta="Live subscription recurring baseline" tone={revenue.economics.mrrCents === null ? "warn" : "good"} />
          <AdminStatCard label="ARR" value={formatMoney(revenue.economics.arrCents)} meta="MRR annualized" tone={revenue.economics.arrCents === null ? "warn" : "good"} />
          <AdminStatCard label="ARPU" value={formatMoney(revenue.economics.arpuCents)} meta="MRR divided by live paid users" tone={revenue.gates.arpuBaseline ? "good" : "warn"} />
          <AdminStatCard label="LTV" value={formatMoney(revenue.economics.ltvBaselineCents)} meta="Requires retained paid renewal/churn evidence" tone={revenue.gates.ltvBaseline ? "good" : "bad"} />
          <AdminStatCard label="CAC" value={formatMoney(revenue.economics.cacCents)} meta="Campaign spend divided by paid conversions" tone={revenue.economics.cacCents === null ? "warn" : "good"} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.2fr]">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-sm font-semibold text-slate-100">Evidence gates</div>
            <div className="mt-3 grid gap-2">
              {([
                ["First paid customers", revenue.gates.firstPaidCustomers],
                ["Trial-to-paid evidence", revenue.gates.trialToPaidEvidence],
                ["Free-to-paid evidence", revenue.gates.freeToPaidEvidence],
                ["ARPU baseline", revenue.gates.arpuBaseline],
                ["LTV baseline", revenue.gates.ltvBaseline],
                ["Acquisition campaign evidence", revenue.gates.realAcquisitionCampaignEvidence],
              ] satisfies Array<[string, boolean]>).map(([label, passed]) => (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-950/35 px-3 py-2 text-sm" key={String(label)}>
                  <span className="text-slate-300">{label}</span>
                  <StatusBadge tone={passed ? "good" : "bad"}>{passed ? "proven" : "missing"}</StatusBadge>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-sm font-semibold text-slate-100">Blockers</div>
            {revenue.blockers.length ? (
              <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-100">
                {revenue.blockers.map((blocker) => (
                  <li className="rounded-lg border border-amber-300/15 bg-amber-300/[0.06] px-3 py-2" key={blocker}>{blocker}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.06] px-3 py-2 text-sm text-emerald-100">All revenue validation gates have measurable evidence.</p>
            )}
          </div>
        </div>
      </AdminSection>

      <AdminSection title="Acquisition campaign evidence" subtitle="Campaign rows come from referral, organic, share, checkout, and explicit campaign metadata events. Spend and revenue remain unknown unless events include campaignSpendCents and campaignRevenueCents.">
        {revenue.campaigns.length ? (
          <AdminTable>
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-[10px] uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">Source</th>
                  <th className="px-3 py-3">Campaign</th>
                  <th className="px-3 py-3">Visitors</th>
                  <th className="px-3 py-3">Signups</th>
                  <th className="px-3 py-3">Paid conversions</th>
                  <th className="px-3 py-3">Spend</th>
                  <th className="px-3 py-3">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {revenue.campaigns.map((campaign) => (
                  <tr className="text-slate-300" key={`${campaign.source}:${campaign.campaign}`}>
                    <td className="px-3 py-3">{campaign.source}</td>
                    <td className="px-3 py-3">{campaign.campaign}</td>
                    <td className="px-3 py-3">{formatCount(campaign.visitors)}</td>
                    <td className="px-3 py-3">{formatCount(campaign.signups)}</td>
                    <td className="px-3 py-3">{formatCount(campaign.paidConversions)}</td>
                    <td className="px-3 py-3">{formatMoney(campaign.spendCents)}</td>
                    <td className="px-3 py-3">{formatMoney(campaign.revenueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTable>
        ) : (
          <AdminEmpty>No acquisition campaign evidence found.</AdminEmpty>
        )}
      </AdminSection>

      <AdminSection title="Subscriptions" subtitle="Stripe-synced billing state. Stripe remains the source of truth; this page does not grant manual premium access.">
        {billing.subscriptions.length ? (
          <AdminTable>
            <table className="min-w-[1200px] w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-[10px] uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">User</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Plan</th>
                  <th className="px-3 py-3">Mode</th>
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
                    <td className="px-3 py-3"><StatusBadge tone={item.stripeMode === "test" ? "warn" : "good"}>{item.stripeMode ?? "live"}</StatusBadge></td>
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
                <div className="mt-1 font-mono text-xs text-slate-500">{event.stripeMode ?? "live"} / {event.stripeEventId ?? "No Stripe event id"}</div>
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

function formatCount(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}

function formatMoney(value: number | null): string {
  if (value === null) return "Unproven";
  return new Intl.NumberFormat("en", { currency: "USD", maximumFractionDigits: 0, style: "currency" }).format(value / 100);
}

function formatPct(value: number | null): string {
  return value === null ? "Unproven" : `${value.toFixed(2)}%`;
}
