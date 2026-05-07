"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { AccountPill } from "@/components/account/AccountPill";
import { BrandMark } from "@/components/brand/BrandMark";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ACCOUNT_NAV_ITEM, MOBILE_BOTTOM_NAV_ITEMS, MOBILE_MORE_NAV_LABEL, PRIMARY_NAV_ITEMS, activeSectionTitle, drawerNavSections, isActivePath, visibleUtilityNavItems, type AppNavItem } from "@/lib/navigation";

export function DesktopTerminalNav() {
  const pathname = usePathname();
  const { entitlement } = useCurrentUser();
  const utilities = visibleUtilityNavItems(entitlement.isAdmin);

  return (
    <div className="hidden min-w-0 flex-1 items-center justify-center gap-3 xl:flex">
      <nav aria-label="Primary navigation" className="flex min-w-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] p-1 shadow-inner shadow-black/20">
        {PRIMARY_NAV_ITEMS.map((item) => <DesktopNavLink item={item} key={item.href} pathname={pathname} primary />)}
      </nav>
      <nav aria-label="Utility navigation" className="flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/45 p-1">
        {utilities.map((item) => <DesktopNavLink item={item} key={item.href} pathname={pathname} />)}
      </nav>
    </div>
  );
}

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
    document.body.style.overflow = "hidden";
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
        <div className="min-w-0 flex-1">
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
          <span className="relative h-4 w-5">
            <span className={`absolute left-0 top-0 h-0.5 w-5 rounded-full bg-current transition ${open ? "translate-y-[7px] rotate-45" : ""}`} />
            <span className={`absolute left-0 top-[7px] h-0.5 w-5 rounded-full bg-current transition ${open ? "opacity-0" : ""}`} />
            <span className={`absolute left-0 top-[14px] h-0.5 w-5 rounded-full bg-current transition ${open ? "-translate-y-[7px] -rotate-45" : ""}`} />
          </span>
        </button>
      </div>

      <div
        aria-hidden="true"
        className={`fixed left-1/2 top-1/2 z-[8990] h-[200dvh] w-[200dvw] -translate-x-1/2 -translate-y-1/2 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setOpen(false)}
      />
      <aside
        aria-labelledby={drawerTitleId}
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-[9000] flex h-dvh w-[min(88vw,380px)] flex-col border-l border-white/10 bg-slate-950/95 shadow-2xl shadow-black/50 ring-1 ring-cyan-300/10 backdrop-blur-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
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
                <div className="mt-1 text-xs text-slate-500">{accountStatusLabel(authenticated, entitlement.plan)}</div>
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

      <nav aria-label="Primary mobile navigation" className="fixed inset-x-3 bottom-3 z-[8500] grid grid-cols-5 gap-1 rounded-2xl border border-white/10 bg-slate-950/90 p-1 shadow-2xl shadow-black/40 backdrop-blur-xl">
        {MOBILE_BOTTOM_NAV_ITEMS.map((item) => <BottomNavLink item={item} key={item.href} pathname={pathname} />)}
        <BottomMenuButton buttonRef={bottomMenuButtonRef} onClick={() => setOpen(true)} open={open} />
      </nav>
    </div>
  );
}

function DesktopNavLink({ item, pathname, primary = false }: { item: AppNavItem; pathname: string; primary?: boolean }) {
  const active = isActivePath(pathname, item.href);
  const base = primary ? "px-3.5 py-2 text-sm" : "px-3 py-2 text-xs";
  return (
    <Link
      className={`inline-flex min-h-9 max-w-full items-center rounded-full border font-semibold transition-all duration-200 ${base} ${
        active
          ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.18)]"
          : "border-transparent text-slate-400 hover:border-cyan-300/25 hover:bg-white/[0.05] hover:text-slate-100"
      }`}
      href={item.href}
    >
      {item.label}
    </Link>
  );
}

function DrawerNavLink({ item, pathname }: { item: AppNavItem; pathname: string }) {
  const active = isActivePath(pathname, item.href);
  return (
    <Link
      className={`flex min-h-11 items-center justify-between rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
        active ? "border-cyan-300/35 bg-cyan-400/12 text-cyan-100" : "border-white/10 bg-white/[0.025] text-slate-300 hover:border-cyan-300/25 hover:bg-white/[0.05] hover:text-slate-100"
      }`}
      href={item.href}
    >
      <span>{item.label}</span>
      <span className="text-xs text-slate-600">{active ? "Active" : "Open"}</span>
    </Link>
  );
}

function BottomNavLink({ item, pathname }: { item: AppNavItem; pathname: string }) {
  const active = isActivePath(pathname, item.href);
  return (
    <Link
      className={`relative flex min-h-12 flex-col items-center justify-center rounded-xl border px-1 text-center text-[11px] font-semibold transition ${
        active ? "border-cyan-300/35 bg-cyan-400/15 text-cyan-100" : "border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"
      }`}
      href={item.href}
    >
      {active ? <span className="absolute left-1/2 top-1 h-0.5 w-7 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.45)]" /> : null}
      <span className="truncate pt-1">{item.label}</span>
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
      <span className="relative h-3.5 w-4">
        <span className="absolute left-0 top-0 h-0.5 w-4 rounded-full bg-current" />
        <span className="absolute left-0 top-[6px] h-0.5 w-4 rounded-full bg-current" />
        <span className="absolute left-0 top-[12px] h-0.5 w-4 rounded-full bg-current" />
      </span>
      <span className="mt-1 truncate">{MOBILE_MORE_NAV_LABEL}</span>
    </button>
  );
}

function accountStatusLabel(authenticated: boolean, plan: string): string {
  if (!authenticated) return "Sign in to save watchlists and alerts";
  if (plan === "admin") return "Admin workspace";
  if (plan === "premium") return "Premium workspace";
  return "Free workspace";
}
