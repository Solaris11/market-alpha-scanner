import Link from "next/link";
import { MobileIntelligenceDeck } from "@/components/mobile/MobileIntelligenceDeck";
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
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Mobile App Setup</div>
              <h2 className="mt-2 text-xl font-semibold text-slate-50">Install TradeVeto on your phone</h2>
                <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-400 sm:line-clamp-none">
                  {center?.summary ?? "Mobile intelligence is temporarily unavailable. Core terminal data remains available."}
                </p>
              </div>
              <Link className="w-full rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-center text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15 sm:w-fit" href="/terminal">
                Open terminal
              </Link>
            </div>
            <MobileIntelligenceDeck packets={center?.packets.length ? center.packets : fallbackPackets()} />
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
          summary="Install and notification settings stay available after the main mobile workflow."
          title="Install and notification setup"
        >
          <PwaInstallCard />
          <PushPermissionCard />
          <MobileReadinessChecklist />
        </ResponsiveAdvancedDetails>

        {center?.limitations.length ? (
          <section className="rounded-2xl border border-amber-300/15 bg-amber-400/[0.055] p-4 text-sm leading-6 text-amber-50/75 sm:p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">Mobile Setup Notes</div>
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
    { href: "/discover", label: "One-hand scanner", summary: "Open full-market discovery." },
    { href: "/terminal", label: "What matters now", summary: "Market state and top risks." },
    { href: "/opportunities", label: "Opportunities", summary: "Ranked setup cards." },
    { href: "/terminal#mobile-watchlist", label: "Watchlist", summary: "Symbols to revisit." },
    { href: "/alerts", label: "Alerts", summary: "Notification rules." },
  ];

  return (
    <section
      className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      data-mobile-gesture-ignore="true"
      id="alerts"
    >
      {actions.map((action) => (
        <Link className="tv-tap-motion min-h-20 min-w-[9.75rem] snap-start rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-cyan-300/35 hover:bg-cyan-400/[0.06] sm:min-w-0" href={action.href} key={action.href}>
          <div className="text-sm font-semibold text-slate-100">{action.label}</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{action.summary}</p>
        </Link>
      ))}
    </section>
  );
}

function MobileHero({ children }: { children: React.ReactNode }) {
  return (
    <header className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-6" id="install">
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Install TradeVeto</div>
          <h1 className="mt-2 max-w-full break-words text-2xl font-semibold leading-tight tracking-tight text-slate-50 sm:text-4xl">A phone-friendly TradeVeto workspace</h1>
          <p className="mt-3 max-w-[20rem] text-sm leading-6 text-slate-400 sm:max-w-3xl">
            You can install TradeVeto from your browser, keep the research workspace close, and enable high-signal alerts when notifications are available.
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
    { label: "Install flow", value: "Browser prompt plus iPhone Add to Home Screen fallback" },
    { label: "Notifications", value: "Browser permission is required before mobile alerts can be sent" },
    { label: "Future app", value: "Native app-store versions can come later; beta uses the web app first" },
  ];

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-5" id="setup">
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
