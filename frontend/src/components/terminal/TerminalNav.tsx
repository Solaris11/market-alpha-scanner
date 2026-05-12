"use client";

import Link from "next/link";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpenCheck,
  Bot,
  BriefcaseBusiness,
  ChartCandlestick,
  Code2,
  Gauge,
  HelpCircle,
  LayoutDashboard,
  LineChart,
  Menu,
  Smartphone,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { AccountPill } from "@/components/account/AccountPill";
import { BrandMark } from "@/components/brand/BrandMark";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ACCOUNT_NAV_ITEM, MOBILE_BOTTOM_NAV_ITEMS, MOBILE_MORE_NAV_LABEL, PRIMARY_NAV_ITEMS, activeSectionTitle, drawerNavSections, isActivePath, visibleUtilityNavItems, type AppNavItem } from "@/lib/navigation";
import { useNavigationIntent } from "./NavigationPerformance";

export function DesktopTerminalNav() {
  const pathname = usePathname();
  const { entitlement } = useCurrentUser();
  const utilities = visibleUtilityNavItems(entitlement.isAdmin);

  return (
    <div className="hidden min-w-0 flex-1 items-center justify-start xl:flex">
      <div className="flex max-w-full min-w-0 items-center gap-3 overflow-x-auto rounded-[1.35rem] border border-cyan-300/12 bg-slate-950/35 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <nav aria-label="Primary navigation" className="flex shrink-0 items-center gap-1.5 rounded-[1.1rem] border border-cyan-300/12 bg-cyan-400/[0.035] p-1">
          {PRIMARY_NAV_ITEMS.map((item) => <DesktopNavLink item={item} key={item.href} pathname={pathname} primary />)}
        </nav>
        <nav aria-label="Utility navigation" className="flex shrink-0 items-center gap-1.5 rounded-[1.1rem] border border-white/10 bg-violet-400/[0.035] p-1">
          {utilities.map((item) => <DesktopNavLink item={item} key={item.href} pathname={pathname} />)}
        </nav>
      </div>
    </div>
  );
}

const NAV_ICON_MAP: Record<string, { Icon: LucideIcon; tone: string }> = {
  account: { Icon: UsersRound, tone: "text-cyan-200" },
  advanced: { Icon: Gauge, tone: "text-violet-200" },
  alerts: { Icon: Bell, tone: "text-amber-200" },
  community: { Icon: UsersRound, tone: "text-emerald-200" },
  dashboard: { Icon: LayoutDashboard, tone: "text-cyan-200" },
  developers: { Icon: Code2, tone: "text-violet-200" },
  history: { Icon: BookOpenCheck, tone: "text-violet-200" },
  mobile: { Icon: Smartphone, tone: "text-emerald-200" },
  opportunities: { Icon: ChartCandlestick, tone: "text-emerald-200" },
  paper: { Icon: BriefcaseBusiness, tone: "text-emerald-200" },
  performance: { Icon: LineChart, tone: "text-cyan-200" },
  support: { Icon: HelpCircle, tone: "text-cyan-200" },
  "strategy-labs": { Icon: Bot, tone: "text-violet-200" },
  terminal: { Icon: Activity, tone: "text-cyan-200" },
};

const NAV_COLOR_MAP: Record<string, { active: string; hover: string; icon: string; rail: string }> = {
  alerts: {
    active: "border-amber-300/45 bg-amber-300/[0.14] text-amber-50 shadow-[0_0_26px_rgba(251,191,36,0.16)]",
    hover: "hover:border-amber-300/30 hover:bg-amber-300/[0.08] hover:text-amber-100",
    icon: "border-amber-300/30 bg-amber-300/15 text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.18)]",
    rail: "bg-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.55)]",
  },
  community: {
    active: "border-emerald-300/45 bg-emerald-300/[0.13] text-emerald-50 shadow-[0_0_26px_rgba(52,211,153,0.16)]",
    hover: "hover:border-emerald-300/30 hover:bg-emerald-300/[0.08] hover:text-emerald-100",
    icon: "border-emerald-300/30 bg-emerald-300/15 text-emerald-100 shadow-[0_0_18px_rgba(52,211,153,0.18)]",
    rail: "bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.55)]",
  },
  developers: {
    active: "border-violet-300/45 bg-violet-300/[0.13] text-violet-50 shadow-[0_0_26px_rgba(167,139,250,0.16)]",
    hover: "hover:border-violet-300/30 hover:bg-violet-300/[0.08] hover:text-violet-100",
    icon: "border-violet-300/30 bg-violet-300/15 text-violet-100 shadow-[0_0_18px_rgba(167,139,250,0.18)]",
    rail: "bg-violet-300 shadow-[0_0_14px_rgba(167,139,250,0.55)]",
  },
  history: {
    active: "border-violet-300/45 bg-violet-300/[0.13] text-violet-50 shadow-[0_0_26px_rgba(167,139,250,0.16)]",
    hover: "hover:border-violet-300/30 hover:bg-violet-300/[0.08] hover:text-violet-100",
    icon: "border-violet-300/30 bg-violet-300/15 text-violet-100 shadow-[0_0_18px_rgba(167,139,250,0.18)]",
    rail: "bg-violet-300 shadow-[0_0_14px_rgba(167,139,250,0.55)]",
  },
  mobile: {
    active: "border-emerald-300/45 bg-emerald-300/[0.13] text-emerald-50 shadow-[0_0_26px_rgba(52,211,153,0.16)]",
    hover: "hover:border-emerald-300/30 hover:bg-emerald-300/[0.08] hover:text-emerald-100",
    icon: "border-emerald-300/30 bg-emerald-300/15 text-emerald-100 shadow-[0_0_18px_rgba(52,211,153,0.18)]",
    rail: "bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.55)]",
  },
  opportunities: {
    active: "border-emerald-300/45 bg-emerald-300/[0.13] text-emerald-50 shadow-[0_0_26px_rgba(52,211,153,0.16)]",
    hover: "hover:border-emerald-300/30 hover:bg-emerald-300/[0.08] hover:text-emerald-100",
    icon: "border-emerald-300/30 bg-emerald-300/15 text-emerald-100 shadow-[0_0_18px_rgba(52,211,153,0.18)]",
    rail: "bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.55)]",
  },
  paper: {
    active: "border-emerald-300/45 bg-emerald-300/[0.13] text-emerald-50 shadow-[0_0_26px_rgba(52,211,153,0.16)]",
    hover: "hover:border-emerald-300/30 hover:bg-emerald-300/[0.08] hover:text-emerald-100",
    icon: "border-emerald-300/30 bg-emerald-300/15 text-emerald-100 shadow-[0_0_18px_rgba(52,211,153,0.18)]",
    rail: "bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.55)]",
  },
  "strategy-labs": {
    active: "border-violet-300/45 bg-violet-300/[0.13] text-violet-50 shadow-[0_0_26px_rgba(167,139,250,0.16)]",
    hover: "hover:border-violet-300/30 hover:bg-violet-300/[0.08] hover:text-violet-100",
    icon: "border-violet-300/30 bg-violet-300/15 text-violet-100 shadow-[0_0_18px_rgba(167,139,250,0.18)]",
    rail: "bg-violet-300 shadow-[0_0_14px_rgba(167,139,250,0.55)]",
  },
};

const DEFAULT_NAV_COLOR = {
  active: "border-cyan-300/45 bg-cyan-300/[0.13] text-cyan-50 shadow-[0_0_26px_rgba(34,211,238,0.16)]",
  hover: "hover:border-cyan-300/30 hover:bg-cyan-300/[0.08] hover:text-cyan-100",
  icon: "border-cyan-300/30 bg-cyan-300/15 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.18)]",
  rail: "bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.55)]",
};

export function MobileTerminalNav() {
  const pathname = usePathname();
  const router = useRouter();
  const drawerTitleId = useId();
  const drawerRef = useRef<HTMLElement | null>(null);
  const topMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const bottomMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const { authenticated, entitlement, logout, user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const title = activeSectionTitle(pathname, entitlement.isAdmin);
  const sections = drawerNavSections(entitlement.isAdmin);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const previousSuppressFeedback = document.documentElement.dataset.tradevetoSuppressFeedback;
    document.body.style.overflow = "hidden";
    document.documentElement.dataset.tradevetoSuppressFeedback = "true";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (drawerRef.current?.contains(target)) return;
      if (topMenuButtonRef.current?.contains(target)) return;
      if (bottomMenuButtonRef.current?.contains(target)) return;
      setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.body.style.overflow = previous;
      if (previousSuppressFeedback === undefined) {
        delete document.documentElement.dataset.tradevetoSuppressFeedback;
      } else {
        document.documentElement.dataset.tradevetoSuppressFeedback = previousSuppressFeedback;
      }
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function handleLogout() {
    setOpen(false);
    await logout();
    router.refresh();
  }

  return (
    <div className="xl:hidden">
      <div className="flex min-h-14 items-center gap-2">
        <Link aria-label="TradeVeto Terminal" className="min-w-0 shrink-0" href="/terminal">
          <BrandMark compact />
        </Link>
        <div className="hidden min-w-0 flex-1 sm:block">
          <div className="truncate text-sm font-semibold text-slate-50">{title}</div>
          <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300/80">Decision Intelligence</div>
        </div>
        <NotificationBell />
        <AccountPill compact />
        <button
          aria-controls="tradeveto-mobile-drawer"
          aria-expanded={open}
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 text-slate-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/10"
          onClick={() => setOpen((value) => !value)}
          ref={topMenuButtonRef}
          type="button"
        >
          <span className="hidden text-xs font-semibold sm:inline">{open ? "Close" : "More"}</span>
          <Menu aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      {open ? (
        <>
          <div
            aria-hidden="true"
            className="fixed left-0 top-0 z-[8990] h-dvh w-dvw bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside
            aria-labelledby={drawerTitleId}
            className="fixed right-0 top-0 z-[9000] flex h-dvh w-[min(88vw,380px)] flex-col border-l border-white/10 bg-slate-950/95 shadow-2xl shadow-black/50 ring-1 ring-cyan-300/10 backdrop-blur-2xl"
            id="tradeveto-mobile-drawer"
            ref={drawerRef}
          >
            <div className="border-b border-white/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/80">TradeVeto</div>
                  <h2 className="mt-1 text-lg font-semibold text-slate-50" id={drawerTitleId}>All Navigation</h2>
                </div>
                <button className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300" onClick={() => setOpen(false)} type="button">
                  <span aria-hidden="true">x</span>
                  <span className="sr-only">Close navigation menu</span>
                </button>
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-100">{user?.displayName || user?.email || "Guest workspace"}</div>
                    <div className="mt-1 text-xs text-slate-500">{accountStatusLabel(authenticated, entitlement.plan, entitlement.betaAccess)}</div>
                  </div>
                  <AccountPill compact />
                </div>
              </div>
            </div>

            <nav aria-label="Mobile drawer navigation" className="flex-1 space-y-5 overflow-y-auto p-4">
              {sections.map((section) => (
                <div key={section.label}>
                  <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{section.label}</div>
                  <div className="grid gap-1.5">
                    {section.items.map((item) => <DrawerNavLink item={item} key={item.href} pathname={pathname} />)}
                  </div>
                </div>
              ))}
            </nav>

            <div className="border-t border-white/10 p-4">
              <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Account</div>
              <div className="grid grid-cols-2 gap-2">
                <DrawerNavLink item={ACCOUNT_NAV_ITEM} pathname={pathname} />
                {authenticated ? (
                  <button className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-3 py-3 text-left text-sm font-semibold text-rose-100" onClick={() => void handleLogout()} type="button">
                    Sign out
                  </button>
                ) : (
                  <Link className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-3 text-sm font-semibold text-cyan-100" href="/account">Sign in</Link>
                )}
              </div>
            </div>
          </aside>
        </>
      ) : null}

      <nav aria-label="Primary mobile navigation" className="fixed inset-x-3 z-[8500] grid grid-cols-5 gap-1 rounded-2xl border border-white/10 bg-slate-950/90 p-1 shadow-2xl shadow-black/40 backdrop-blur-xl sm:hidden" style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        {MOBILE_BOTTOM_NAV_ITEMS.map((item) => <BottomNavLink item={item} key={item.href} pathname={pathname} />)}
        <BottomMenuButton buttonRef={bottomMenuButtonRef} onClick={() => setOpen(true)} open={open} />
      </nav>
    </div>
  );
}

function DesktopNavLink({ item, pathname, primary = false }: { item: AppNavItem; pathname: string; primary?: boolean }) {
  const active = isActivePath(pathname, item.href);
  const base = primary ? "px-3 py-2 text-[13px] 2xl:text-sm" : "px-3 py-2 text-xs";
  const color = NAV_COLOR_MAP[item.key] ?? DEFAULT_NAV_COLOR;
  const navigationIntent = useNavigationIntent(item.href, item.label);
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl border font-semibold transition-all duration-200 hover:-translate-y-0.5 ${base} ${active ? color.active : `border-transparent text-slate-400 ${color.hover}`}`}
      href={item.href}
      onClick={navigationIntent.onClick}
      onFocus={navigationIntent.onFocus}
      onPointerEnter={navigationIntent.onPointerEnter}
      prefetch
    >
      <NavGlyph item={item} active={active} />
      {item.label}
    </Link>
  );
}

function DrawerNavLink({ item, pathname }: { item: AppNavItem; pathname: string }) {
  const active = isActivePath(pathname, item.href);
  const color = NAV_COLOR_MAP[item.key] ?? DEFAULT_NAV_COLOR;
  const navigationIntent = useNavigationIntent(item.href, item.label);
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`flex min-h-12 items-center justify-between rounded-2xl border px-3 py-2 text-sm font-semibold transition ${active ? color.active : `border-white/8 bg-white/[0.025] text-slate-300 ${color.hover}`}`}
      href={item.href}
      onClick={navigationIntent.onClick}
      onFocus={navigationIntent.onFocus}
      onPointerEnter={navigationIntent.onPointerEnter}
      prefetch
    >
      <span className="flex min-w-0 items-center gap-3">
        <NavGlyph item={item} active={active} />
        <span className="truncate">{item.label}</span>
      </span>
      <span className="text-xs text-slate-600">{active ? "Current" : ""}</span>
    </Link>
  );
}

function BottomNavLink({ item, pathname }: { item: AppNavItem; pathname: string }) {
  const active = isActivePath(pathname, item.href);
  const label = item.key === "opportunities" ? "Ideas" : item.label;
  const color = NAV_COLOR_MAP[item.key] ?? DEFAULT_NAV_COLOR;
  const navigationIntent = useNavigationIntent(item.href, label);
  return (
    <Link
      className={`relative flex min-h-12 flex-col items-center justify-center rounded-xl border px-1 text-center text-[11px] font-semibold transition ${
        active ? color.active : `border-transparent text-slate-400 ${color.hover}`
      }`}
      href={item.href}
      onClick={navigationIntent.onClick}
      onFocus={navigationIntent.onFocus}
      onPointerEnter={navigationIntent.onPointerEnter}
      prefetch
    >
      {active ? <span className={`absolute left-1/2 top-1 h-0.5 w-7 -translate-x-1/2 rounded-full ${color.rail}`} /> : null}
      <NavGlyph item={item} active={active} compact />
      <span className="mt-0.5 truncate">{label}</span>
    </Link>
  );
}

function BottomMenuButton({ buttonRef, onClick, open }: { buttonRef: RefObject<HTMLButtonElement | null>; onClick: () => void; open: boolean }) {
  return (
    <button
      aria-controls="tradeveto-mobile-drawer"
      aria-expanded={open}
      aria-label={open ? "Close full navigation menu" : "Open full navigation menu"}
      className={`flex min-h-12 flex-col items-center justify-center rounded-xl border px-1 text-center text-[11px] font-semibold transition ${
        open ? "border-cyan-300/35 bg-cyan-400/15 text-cyan-100" : "border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"
      }`}
      onClick={onClick}
      ref={buttonRef}
      type="button"
    >
      <Menu aria-hidden="true" className="h-4 w-4" />
      <span className="mt-1 truncate">{MOBILE_MORE_NAV_LABEL}</span>
    </button>
  );
}

function NavGlyph({ active, compact = false, item }: { active: boolean; compact?: boolean; item: AppNavItem }) {
  const config = NAV_ICON_MAP[item.key] ?? { Icon: BarChart3, tone: "text-cyan-200" };
  const color = NAV_COLOR_MAP[item.key] ?? DEFAULT_NAV_COLOR;
  const Icon = config.Icon;
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-xl border transition ${
        compact ? "h-5 w-5" : "h-7 w-7"
      } ${active ? color.icon : `border-white/10 bg-white/[0.04] ${config.tone}`}`}
    >
      <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2.2} />
    </span>
  );
}

function accountStatusLabel(authenticated: boolean, plan: string, betaAccess = false): string {
  if (!authenticated) return "Sign in to save watchlists and alerts";
  if (plan === "admin") return "Admin workspace";
  if (betaAccess) return "Closed beta workspace";
  if (plan === "premium") return "Premium workspace";
  return "Free workspace";
}
