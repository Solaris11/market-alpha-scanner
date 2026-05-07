import Link from "next/link";
import type { ReactNode } from "react";
import type { AuthUser } from "@/lib/server/auth";

const ADMIN_LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/alerts", label: "Alerts" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/scanner", label: "Scanner" },
  { href: "/admin/calibration", label: "Calibration" },
  { href: "/admin/monitoring", label: "Monitoring" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/audit", label: "Audit" },
] as const;

export function AdminHeader({ user }: { user: AuthUser }) {
  return (
    <header className="mb-5 rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/25 backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-300">Admin Console</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">Operations control plane</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Server-side protected SaaS operations for users, billing, alerts, scanner health, monitoring, and audit trails.
          </p>
        </div>
        <span className="w-fit rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
          Admin: {user.email}
        </span>
      </div>
      <nav className="mt-5 flex flex-wrap gap-2">
        {ADMIN_LINKS.map((item) => (
          <Link className="inline-flex min-h-[38px] items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/40 hover:bg-cyan-400/10 hover:text-cyan-100" href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function AdminSection({ children, title, subtitle }: { children: ReactNode; subtitle?: string; title: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/25 backdrop-blur-xl">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-slate-50">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function AdminStatCard({ label, value, meta, tone = "default" }: { label: string; meta?: string; tone?: "default" | "good" | "warn" | "bad"; value: ReactNode }) {
  const toneClass = {
    bad: "border-rose-300/25 bg-rose-400/[0.08] text-rose-100",
    default: "border-white/10 bg-white/[0.03] text-slate-50",
    good: "border-emerald-300/25 bg-emerald-400/[0.08] text-emerald-100",
    warn: "border-amber-300/25 bg-amber-400/[0.08] text-amber-100",
  }[tone];
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {meta ? <div className="mt-1 text-xs leading-5 text-slate-400">{meta}</div> : null}
    </div>
  );
}

export function AdminTable({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-xl border border-white/10">{children}</div>;
}

export function AdminEmpty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">{children}</div>;
}

export function StatusBadge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "good" | "warn" | "bad" }) {
  const toneClass = {
    bad: "border-rose-300/25 bg-rose-400/10 text-rose-100",
    default: "border-white/10 bg-white/[0.04] text-slate-200",
    good: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
    warn: "border-amber-300/25 bg-amber-400/10 text-amber-100",
  }[tone];
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${toneClass}`}>{children}</span>;
}
