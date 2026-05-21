import Link from "next/link";
import type { ReactNode } from "react";

type UtilityTone = "amber" | "cyan" | "emerald" | "rose" | "violet";

type UtilityAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

type UtilityMetric = {
  detail?: string;
  label: string;
  tone?: UtilityTone;
  value: string;
};

const toneClasses: Record<UtilityTone, { accent: string; border: string; glow: string; panel: string; text: string }> = {
  amber: {
    accent: "bg-amber-300",
    border: "border-amber-300/22",
    glow: "shadow-amber-950/20",
    panel: "bg-[radial-gradient(circle_at_12%_0%,rgba(251,191,36,0.18),transparent_28rem),radial-gradient(circle_at_92%_12%,rgba(244,63,94,0.11),transparent_24rem),linear-gradient(135deg,rgba(2,6,23,0.98),rgba(15,23,42,0.78))]",
    text: "text-amber-100",
  },
  cyan: {
    accent: "bg-cyan-300",
    border: "border-cyan-300/22",
    glow: "shadow-cyan-950/20",
    panel: "bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.2),transparent_30rem),radial-gradient(circle_at_90%_10%,rgba(167,139,250,0.12),transparent_26rem),linear-gradient(135deg,rgba(2,6,23,0.98),rgba(15,23,42,0.78))]",
    text: "text-cyan-100",
  },
  emerald: {
    accent: "bg-emerald-300",
    border: "border-emerald-300/22",
    glow: "shadow-emerald-950/20",
    panel: "bg-[radial-gradient(circle_at_12%_0%,rgba(52,211,153,0.18),transparent_30rem),radial-gradient(circle_at_92%_12%,rgba(34,211,238,0.12),transparent_24rem),linear-gradient(135deg,rgba(2,6,23,0.98),rgba(15,23,42,0.78))]",
    text: "text-emerald-100",
  },
  rose: {
    accent: "bg-rose-300",
    border: "border-rose-300/22",
    glow: "shadow-rose-950/20",
    panel: "bg-[radial-gradient(circle_at_12%_0%,rgba(244,63,94,0.2),transparent_30rem),radial-gradient(circle_at_88%_12%,rgba(251,191,36,0.11),transparent_24rem),linear-gradient(135deg,rgba(2,6,23,0.98),rgba(15,23,42,0.78))]",
    text: "text-rose-100",
  },
  violet: {
    accent: "bg-violet-300",
    border: "border-violet-300/22",
    glow: "shadow-violet-950/20",
    panel: "bg-[radial-gradient(circle_at_12%_0%,rgba(167,139,250,0.2),transparent_30rem),radial-gradient(circle_at_90%_10%,rgba(34,211,238,0.12),transparent_24rem),linear-gradient(135deg,rgba(2,6,23,0.98),rgba(15,23,42,0.78))]",
    text: "text-violet-100",
  },
};

export function UtilityPageStack({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`space-y-5 ${className}`}>{children}</div>;
}

export function UtilityHero({
  actions = [],
  children,
  eyebrow,
  metrics = [],
  right,
  subtitle,
  title,
  tone = "cyan",
}: {
  actions?: UtilityAction[];
  children?: ReactNode;
  eyebrow: string;
  metrics?: UtilityMetric[];
  right?: ReactNode;
  subtitle: string;
  title: string;
  tone?: UtilityTone;
}) {
  const style = toneClasses[tone];
  return (
    <section className={`relative overflow-hidden rounded-[2.15rem] border ${style.border} ${style.panel} p-4 shadow-2xl ${style.glow} ring-1 ring-white/5 sm:p-6`}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full border border-white/10 bg-white/[0.025]" />
      <div aria-hidden="true" className="pointer-events-none absolute right-10 top-16 h-24 w-24 rounded-full border border-cyan-300/15" />
      <div className="relative grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
        <div className="min-w-0">
          <div className={`inline-flex rounded-full border ${style.border} bg-white/[0.055] px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${style.text}`}>{eyebrow}</div>
          <h1 className="mt-4 max-w-5xl text-balance text-3xl font-black uppercase leading-[0.95] text-white sm:text-5xl lg:text-6xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">{subtitle}</p>
          {actions.length ? (
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              {actions.map((action) => <UtilityActionLink action={action} key={`${action.href}:${action.label}`} tone={tone} />)}
            </div>
          ) : null}
          {metrics.length ? <UtilityMetricGrid metrics={metrics} /> : null}
          {children ? <div className="mt-5">{children}</div> : null}
        </div>
        {right ? <div className="min-w-0">{right}</div> : null}
      </div>
    </section>
  );
}

export function UtilityActionLink({ action, tone = "cyan" }: { action: UtilityAction; tone?: UtilityTone }) {
  const style = toneClasses[tone];
  const primary = action.variant !== "secondary";
  return (
    <Link
      className={
        primary
          ? `inline-flex min-h-12 items-center justify-center rounded-full ${style.accent} px-5 py-3 text-sm font-black text-slate-950 shadow-[0_0_34px_rgba(34,211,238,0.18)] transition hover:brightness-110`
          : "inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.045] px-5 py-3 text-sm font-bold text-slate-100 transition hover:border-cyan-300/40 hover:bg-white/[0.075]"
      }
      href={action.href}
    >
      {action.label}
    </Link>
  );
}

export function UtilityMetricGrid({ metrics }: { metrics: UtilityMetric[] }) {
  return (
    <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <UtilityMetricCell key={`${metric.label}:${metric.value}`} metric={metric} />
      ))}
    </div>
  );
}

export function UtilityMetricCell({ metric }: { metric: UtilityMetric }) {
  const tone = toneClasses[metric.tone ?? "cyan"];
  return (
    <div className={`tv-card-motion min-w-0 rounded-2xl border ${tone.border} bg-slate-950/42 p-3 ring-1 ring-white/5`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${tone.accent} shadow-[0_0_14px_currentColor]`} />
        <div className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{metric.label}</div>
      </div>
      <div className="mt-2 truncate text-2xl font-black text-slate-50">{metric.value}</div>
      {metric.detail ? <p className="mt-1 text-xs leading-5 text-slate-400">{metric.detail}</p> : null}
    </div>
  );
}

export function UtilityCard({
  action,
  children,
  className = "",
  eyebrow,
  href,
  icon,
  title,
  tone = "cyan",
}: {
  action?: string;
  children: ReactNode;
  className?: string;
  eyebrow?: string;
  href?: string;
  icon?: ReactNode;
  title: string;
  tone?: UtilityTone;
}) {
  const style = toneClasses[tone];
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${style.text}`}>{eyebrow}</div> : null}
          <h2 className="mt-1 text-xl font-bold text-slate-50">{title}</h2>
        </div>
        {icon ? <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${style.border} bg-white/[0.055] ${style.text}`}>{icon}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
      {action ? <div className={`mt-4 text-xs font-black uppercase tracking-[0.16em] ${style.text}`}>{action}</div> : null}
    </>
  );
  const classes = `visual-card poster-panel tv-card-motion relative min-w-0 overflow-hidden rounded-3xl border ${style.border} bg-slate-950/52 p-4 shadow-xl ${style.glow} ring-1 ring-white/5 transition ${href ? "hover:-translate-y-0.5 hover:bg-white/[0.065]" : ""} ${className}`;
  if (href) {
    return (
      <Link className={classes} href={href}>
        {content}
      </Link>
    );
  }
  return <section className={classes}>{content}</section>;
}

export function UtilityStatusRows({
  items,
}: {
  items: Array<{
    detail: string;
    label: string;
    tone?: UtilityTone;
    value: string;
  }>;
}) {
  return (
    <div className="grid gap-2">
      {items.map((item) => {
        const style = toneClasses[item.tone ?? "cyan"];
        return (
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/38 p-3 sm:grid-cols-[0.85fr_0.45fr_1.1fr] sm:items-center" key={`${item.label}:${item.value}`}>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-50">{item.label}</div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">current state</div>
            </div>
            <div className={`w-fit rounded-full border ${style.border} bg-white/[0.045] px-2.5 py-1 text-xs font-black ${style.text}`}>{item.value}</div>
            <p className="text-xs leading-5 text-slate-400">{item.detail}</p>
          </div>
        );
      })}
    </div>
  );
}

export function UtilityTimeline({
  items,
}: {
  items: Array<{
    detail: string;
    label: string;
    tone?: UtilityTone;
  }>;
}) {
  return (
    <div className="relative grid gap-3">
      <div aria-hidden="true" className="absolute bottom-2 left-[1.1rem] top-2 w-px bg-gradient-to-b from-cyan-300/35 via-white/10 to-transparent" />
      {items.map((item, index) => {
        const style = toneClasses[item.tone ?? "cyan"];
        return (
          <div className="relative grid grid-cols-[2.25rem_1fr] gap-2" key={`${item.label}:${index}`}>
            <div className={`relative z-10 grid h-9 w-9 place-items-center rounded-full border ${style.border} bg-slate-950 text-xs font-black ${style.text}`}>{index + 1}</div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
              <div className="text-sm font-semibold text-slate-50">{item.label}</div>
              <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
