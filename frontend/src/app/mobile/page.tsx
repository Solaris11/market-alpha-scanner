import Link from "next/link";
import { PushPermissionCard } from "@/components/mobile/PushPermissionCard";
import { PwaInstallCard } from "@/components/mobile/PwaInstallCard";
import { PremiumAccessCta } from "@/components/premium/PremiumAccessCta";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { ResponsiveAdvancedDetails } from "@/components/ui/ResponsiveAdvancedDetails";
import { loadMobileIntelligenceCenter } from "@/lib/server/mobile-push-intelligence";
import { getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";
import { premiumAccessState } from "@/lib/security/premium-access-state";
import type { MobileIntelligencePacket } from "@/lib/trading/mobile-push-intelligence";

export const dynamic = "force-dynamic";

export default async function MobilePage() {
  const entitlement = await getEntitlement();
  const user = entitlement.user;
  const accessState = premiumAccessState({
    authenticated: entitlement.authenticated,
    isAdmin: entitlement.isAdmin,
    isPremium: entitlement.isPremium,
    plan: entitlement.plan,
  });

  if (!user) {
    return (
      <TerminalShell>
        <div className="space-y-5">
          <MobileHero>
            <PremiumAccessCta ctaHref="/account" ctaLabel="Sign in" initialState={accessState} />
          </MobileHero>
          <PwaInstallCard />
          <MobileReadinessChecklist />
          <MobilePreview />
        </div>
      </TerminalShell>
    );
  }

  if (!hasPremiumAccess(entitlement)) {
    return (
      <TerminalShell>
        <div className="space-y-5">
          <MobileHero>
            <PremiumAccessCta ctaHref="/account" ctaLabel="Upgrade" initialState={accessState} refreshOnPremium />
          </MobileHero>
          <PwaInstallCard />
          <MobileReadinessChecklist />
          <MobilePreview />
        </div>
      </TerminalShell>
    );
  }

  const center = await loadMobileIntelligenceCenter(user.id).catch(() => null);

  return (
    <TerminalShell>
      <div className="space-y-5">
        <MobileHero>
          <div className="grid gap-3 sm:grid-cols-3">
            <HeroStat label="Push-ready" value={center?.packets.filter((packet) => packet.pushEligible).length.toLocaleString() ?? "0"} />
            <HeroStat label="Priority alerts" value={center?.packets.filter((packet) => packet.priority === "critical" || packet.priority === "high").length.toLocaleString() ?? "0"} />
            <HeroStat label="Updated" value={center ? formatTime(center.generatedAt) : "Unavailable"} />
          </div>
        </MobileHero>

        <MobilePriorityActions />

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Decision Inbox</div>
                <h2 className="mt-2 text-xl font-semibold text-slate-50">Fast mobile workflow</h2>
                <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-400 sm:line-clamp-none">
                  {center?.summary ?? "Mobile intelligence is temporarily unavailable. Core terminal data remains available."}
                </p>
              </div>
              <Link className="w-full rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-center text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15 sm:w-fit" href="/terminal">
                Open terminal
              </Link>
            </div>
            <div className="-mx-4 mt-5 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(center?.packets.length ? center.packets : fallbackPackets()).map((packet) => (
                <PacketCard key={packet.id} packet={packet} />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Mobile Actions</div>
              <h2 className="mt-2 text-xl font-semibold text-slate-50">Open the right surface fast</h2>
              <div className="mt-4 grid gap-3">
                {(center?.quickActions ?? defaultQuickActions()).map((action) => (
                  <Link className="rounded-xl border border-white/10 bg-white/[0.035] p-3 transition hover:border-cyan-300/35 hover:bg-cyan-400/[0.06]" href={action.href} key={action.href}>
                    <div className="text-sm font-semibold text-slate-100">{action.label}</div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{action.summary}</p>
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Delivery Rules</div>
              <h2 className="mt-2 text-xl font-semibold text-slate-50">Calm by default</h2>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-400">
                {(center?.deliveryPolicy ?? defaultDeliveryPolicy()).map((item) => (
                  <li className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2" key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </div>
        </section>

        <ResponsiveAdvancedDetails
          eyebrow="Device setup"
          summary="Install and push settings stay available after the main decision inbox."
          title="PWA, push, and readiness checks"
        >
          <PwaInstallCard />
          <PushPermissionCard />
          <MobileReadinessChecklist />
        </ResponsiveAdvancedDetails>

        {center?.limitations.length ? (
          <section className="rounded-2xl border border-amber-300/15 bg-amber-400/[0.055] p-4 text-sm leading-6 text-amber-50/75 sm:p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">Mobile Rollout Notes</div>
            <ul className="mt-3 grid gap-2 md:grid-cols-3">
              {center.limitations.map((item) => (
                <li className="rounded-xl border border-amber-200/10 bg-slate-950/30 px-3 py-2" key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </TerminalShell>
  );
}

function MobilePriorityActions() {
  const actions = [
    { href: "/terminal", label: "What matters now", summary: "Market state and top risks." },
    { href: "/opportunities", label: "Opportunities", summary: "Ranked setup cards." },
    { href: "/terminal#mobile-watchlist", label: "Watchlist", summary: "Symbols to revisit." },
    { href: "/alerts", label: "Alerts", summary: "Notification rules." },
    { href: "/opportunities?tab=full", label: "Symbol search", summary: "Find a ticker fast." },
  ];

  return (
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      {actions.map((action) => (
        <Link className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-cyan-300/35 hover:bg-cyan-400/[0.06]" href={action.href} key={action.href}>
          <div className="text-sm font-semibold text-slate-100">{action.label}</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{action.summary}</p>
        </Link>
      ))}
    </section>
  );
}

function MobileHero({ children }: { children: React.ReactNode }) {
  return (
    <header className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-6">
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Mobile Intelligence</div>
          <h1 className="mt-2 max-w-full break-words text-2xl font-semibold leading-tight tracking-tight text-slate-50 sm:text-4xl">TradeVeto on the lock screen</h1>
          <p className="mt-3 max-w-[20rem] text-sm leading-6 text-slate-400 sm:max-w-3xl">
            Install the mobile web app and receive high-signal watchlist, shock, macro, fragility, what-changed, replay, and copilot workflow updates.
          </p>
        </div>
        <div>{children}</div>
      </div>
    </header>
  );
}

function MobilePreview() {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/25 backdrop-blur-xl">
      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Preview</div>
      <h2 className="mt-2 text-xl font-semibold text-slate-50">Mobile-native workflows unlock with Premium</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {["Watchlist alerts", "Shock and macro alerts", "What changed summaries"].map((item) => (
          <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3 text-sm font-semibold text-slate-200" key={item}>{item}</div>
        ))}
      </div>
    </section>
  );
}

function MobileReadinessChecklist() {
  const items = [
    { label: "Manifest", value: "App name, icons, shortcuts, and screenshots configured" },
    { label: "Install flow", value: "Browser prompt plus iOS manual fallback" },
    { label: "Push flow", value: "Permission, subscribe, test, and current packet actions" },
    { label: "Native gap", value: "Store builds, app signing, and native deep links remain future work" },
  ];

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300 sm:tracking-[0.24em]">Mobile Readiness</div>
          <h2 className="mt-2 text-xl font-semibold text-slate-50">Controlled beta checklist</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">PWA launch is ready for browser-based beta testing. Native app store work remains separate.</p>
        </div>
        <span className="w-fit rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-100">PWA first</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-3" key={item.label}>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{item.label}</div>
            <div className="mt-1 text-sm leading-5 text-slate-200">{item.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-50">{value}</div>
    </div>
  );
}

function PacketCard({ packet }: { packet: MobileIntelligencePacket }) {
  return (
    <article className="min-w-[84vw] snap-center rounded-xl border border-white/10 bg-white/[0.035] p-3 transition hover:border-cyan-300/25 hover:bg-cyan-400/[0.055] sm:min-w-0 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${priorityClass(packet.priority)}`}>{packet.urgencyLabel}</span>
            <span className="rounded-full border border-white/10 bg-slate-950/40 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{packet.category.replace("_", " ")}</span>
            {packet.pushEligible ? <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-[11px] font-semibold text-emerald-100">Push eligible</span> : null}
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-50">{packet.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400 sm:line-clamp-none">{packet.body}</p>
          <div className="mt-2 text-xs font-medium text-slate-500">{packet.evidenceLabel}</div>
        </div>
        <Link className="w-full shrink-0 rounded-full border border-cyan-300/35 bg-cyan-400/10 px-3 py-2 text-center text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15 sm:w-auto" href={packet.actionUrl}>
          {packet.actionLabel}
        </Link>
      </div>
    </article>
  );
}

function priorityClass(priority: MobileIntelligencePacket["priority"]): string {
  if (priority === "critical") return "border-rose-300/25 bg-rose-400/10 text-rose-100";
  if (priority === "high") return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  if (priority === "medium") return "border-cyan-300/25 bg-cyan-400/10 text-cyan-100";
  return "border-white/10 bg-white/[0.03] text-slate-300";
}

function fallbackPackets(): MobileIntelligencePacket[] {
  return [
    {
      actionLabel: "Open terminal",
      actionUrl: "/terminal",
      body: "Mobile intelligence is waiting for the latest scanner packet. Review the terminal while this surface warms up.",
      category: "what_changed",
      evidenceLabel: "Scanner packet unavailable",
      id: "fallback:terminal",
      priority: "medium",
      pushEligible: false,
      reasonCodes: ["MOBILE_FALLBACK"],
      score: 55,
      symbol: null,
      title: "Latest mobile packet unavailable",
      urgencyLabel: "Review when ready",
    },
  ];
}

function defaultQuickActions() {
  return [
    { href: "/terminal", label: "Open Terminal", summary: "See current market state and top risks." },
    { href: "/opportunities", label: "Review Opportunities", summary: "Find ranked setups by risk profile." },
    { href: "/terminal#mobile-watchlist", label: "Open Watchlist", summary: "Review tracked symbols and changes." },
    { href: "/alerts", label: "Tune Alerts", summary: "Update notification rules." },
    { href: "/opportunities?tab=full", label: "Find Symbol", summary: "Jump into a symbol or full universe search." },
  ];
}

function defaultDeliveryPolicy(): string[] {
  return [
    "Push alerts are research context only.",
    "High-volatility alerts are not core buy signals.",
    "TradeVeto stays calm during normal closed-market periods.",
  ];
}

function formatTime(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Now";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(parsed));
}
