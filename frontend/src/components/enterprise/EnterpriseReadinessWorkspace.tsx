import Link from "next/link";
import type { EnterpriseAnalyticsItem, EnterpriseCertificationGate, EnterpriseReadinessModel, EnterpriseSessionControl, EnterpriseSsoConnection } from "@/lib/enterprise-readiness";
import { GlassPanel } from "@/components/terminal/ui/GlassPanel";
import { SectionTitle } from "@/components/terminal/ui/SectionTitle";

export function EnterpriseReadinessWorkspace({ model }: { model: EnterpriseReadinessModel }) {
  return (
    <div className="space-y-5">
      <GlassPanel className="overflow-hidden border-cyan-300/15 bg-cyan-400/[0.025] p-5 sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-300">Enterprise Readiness</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">{model.organization.name}</h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
              Organization accounts, shared intelligence workspaces, role-aware collaboration, SSO visibility, session controls, audit logs, and team analytics for professional groups.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <HeaderMetric label="Account" value={model.organization.accountType} />
            <HeaderMetric label="Status" value={model.overallStatus.replace("_", " ")} />
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <HeaderMetric label="Members" value={String(model.teamWorkspace.members.length)} />
          <HeaderMetric label="Shared Symbols" value={String(model.teamWorkspace.sharedWatchlist.length)} />
          <HeaderMetric label="Audit Events" value={String(model.recentAuditEvents.length + model.teamWorkspace.auditTrail.length)} />
          <HeaderMetric label="SSO Providers" value={String(model.ssoConnections.filter((connection) => connection.configured).length)} />
        </div>
      </GlassPanel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <GlassPanel className="p-5">
          <SectionTitle eyebrow="Readiness Gates" title="Enterprise Certification" meta={model.overallStatus.replace("_", " ")} />
          <div className="mt-4 grid gap-3">
            {model.certificationGates.map((gate) => <GateCard gate={gate} key={gate.key} />)}
          </div>
        </GlassPanel>

        <GlassPanel className="p-5">
          <SectionTitle eyebrow="Account Types" title="Organization Boundary" meta={model.organization.planTier} />
          <div className="mt-4 grid gap-2">
            {model.accountTypes.map((type) => (
              <div className={`rounded-2xl border p-4 ${type === model.organization.accountType ? "border-cyan-300/25 bg-cyan-400/[0.07]" : "border-white/10 bg-white/[0.03]"}`} key={type}>
                <div className="text-sm font-black capitalize text-slate-50">{type}</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{accountTypeDescription(type)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-5 text-slate-400">
            Primary domain: {model.organization.primaryDomain ?? "not set"} · SSO required: {model.organization.ssoRequired ? "yes" : "no"}
          </div>
        </GlassPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <GlassPanel className="p-5">
          <SectionTitle eyebrow="Permissions" title="Role Matrix" meta="Owner / Admin / Manager / Member / Viewer" />
          <div className="mt-4 grid gap-3">
            {model.permissionMatrix.map((row) => (
              <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4" key={row.role}>
                <div className="text-sm font-black capitalize text-slate-50">{row.role}</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{row.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.capabilities.map((capability) => (
                    <span className="rounded-full border border-cyan-300/15 bg-cyan-400/[0.06] px-2.5 py-1 text-[11px] font-bold text-cyan-100" key={capability}>
                      {capability}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel className="p-5">
          <SectionTitle eyebrow="Enterprise Auth" title="SSO Readiness" meta="Google / Microsoft / OIDC / SAML" />
          <div className="mt-4 grid gap-3">
            {model.ssoConnections.map((connection) => <SsoCard connection={connection} key={connection.provider} />)}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Google SSO is the currently implemented OAuth login path. Microsoft, generic OIDC, and SAML are configuration-visible enterprise boundaries until customer IdP metadata and callback validation are activated.
          </p>
        </GlassPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <MetricSection eyebrow="Session Controls" items={model.sessionControls} title="Device + Session Governance" />
        <MetricSection eyebrow="Organization Analytics" items={model.analytics} title="Team Intelligence Analytics" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <MetricSection eyebrow="Audit Coverage" items={model.auditCoverage} title="Reviewable Action Trail" />
        <GlassPanel className="p-5">
          <SectionTitle eyebrow="Recent Activity" title="Enterprise Audit Trail" meta={`${model.recentAuditEvents.length} events`} />
          <div className="mt-4 grid gap-2">
            {model.recentAuditEvents.length ? model.recentAuditEvents.slice(0, 8).map((event) => (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3" key={event.id}>
                <div className="text-sm font-bold text-slate-100">{event.action.replaceAll("_", " ")}</div>
                <div className="mt-1 text-xs text-slate-500">{event.targetType} · {event.targetId ?? "organization"} · {shortDate(event.createdAt)}</div>
              </div>
            )) : (
              <p className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-400">No enterprise audit events yet. Organization, workspace, watchlist, research, login, and critical actions will populate this trail.</p>
            )}
          </div>
        </GlassPanel>
      </div>

      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Workspace System" title="Shared Research Operations" meta={model.teamWorkspace.workspace.name} />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <HeaderMetric label="Shared Watchlists" value={String(model.teamWorkspace.sharedWatchlist.length)} />
          <HeaderMetric label="Shared Scanners" value={model.teamWorkspace.topSharedOpportunities.length ? "Ready" : "Limited"} />
          <HeaderMetric label="Shared Alerts" value="Category ready" />
          <HeaderMetric label="Boards" value={String(model.teamWorkspace.topSharedOpportunities.length)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1.5 text-xs font-black text-cyan-100 transition hover:bg-cyan-400/15" href="/team">Open team workspace</Link>
          <Link className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-black text-slate-200 transition hover:border-white/20" href="/admin/audit">Open audit console</Link>
        </div>
      </GlassPanel>

      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Proof Boundary" title="What Is Not Claimed" meta="honest enterprise certification" />
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {model.proofBoundary.map((item) => (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-xs leading-5 text-slate-400" key={item}>{item}</div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="break-words text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500">{label}</div>
      <div className="mt-1 truncate font-mono text-lg font-black capitalize text-slate-50">{value}</div>
    </div>
  );
}

function GateCard({ gate }: { gate: EnterpriseCertificationGate }) {
  return (
    <article className={`rounded-2xl border p-4 ${statusClass(gate.status)}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-black text-slate-50">{gate.label}</div>
          <p className="mt-1 text-xs leading-5 text-slate-400">{gate.evidence}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-200">{gate.status}</span>
      </div>
      {gate.blocker ? <p className="mt-3 text-xs leading-5 text-amber-100">{gate.blocker}</p> : null}
    </article>
  );
}

function SsoCard({ connection }: { connection: EnterpriseSsoConnection }) {
  return (
    <article className={`rounded-2xl border p-4 ${connection.configured ? "border-emerald-300/20 bg-emerald-400/[0.055]" : "border-white/10 bg-white/[0.03]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-slate-50">{connection.label}</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{connection.issuer ?? connection.metadataUrl ?? "Provider configuration not present."}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-200">{connection.status}</span>
      </div>
    </article>
  );
}

function MetricSection({ eyebrow, items, title }: { eyebrow: string; items: EnterpriseAnalyticsItem[] | EnterpriseSessionControl[]; title: string }) {
  return (
    <GlassPanel className="p-5">
      <SectionTitle eyebrow={eyebrow} title={title} meta={`${items.length} controls`} />
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <article className={`rounded-2xl border p-4 ${statusClass(item.status)}`} key={item.key}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-50">{item.label}</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
              </div>
              <span className="font-mono text-sm font-black text-slate-100">{item.value}</span>
            </div>
          </article>
        ))}
      </div>
    </GlassPanel>
  );
}

function accountTypeDescription(type: string): string {
  if (type === "enterprise") return "Organization-wide workspace, SSO visibility, session controls, and audit trails.";
  if (type === "team") return "Shared workspace for a trading group, educator, research team, or family office.";
  return "Single-user research account with an upgrade path to shared workspaces.";
}

function statusClass(status: string): string {
  if (status === "pass") return "border-emerald-300/20 bg-emerald-400/[0.055]";
  if (status === "fail") return "border-rose-300/20 bg-rose-400/[0.07]";
  return "border-amber-300/18 bg-amber-400/[0.055]";
}

function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date);
}
