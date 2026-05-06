"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useCurrentUser, type CurrentUser, type CurrentUserEntitlement } from "@/hooks/useCurrentUser";

export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { entitlement, logout, user } = useCurrentUser();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateMenuPosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const margin = 16;
    const width = 256;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const top = Math.min(rect.bottom + 8, viewportHeight - margin);
    const right = Math.max(margin, viewportWidth - rect.right);

    setMenuStyle({
      maxWidth: `calc(100vw - ${margin * 2}px)`,
      maxHeight: "calc(100vh - 48px)",
      overflowY: "auto",
      position: "fixed",
      right,
      top,
      width,
    });
  }, []);

  useLayoutEffect(() => {
    if (open) updateMenuPosition();
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  if (!user) return null;
  const label = user.displayName || user.email;
  const plan = planStatus(entitlement);
  const profile = profileMeta(user);

  async function handleLogout() {
    setOpen(false);
    await logout();
    router.refresh();
  }

  return (
    <div>
      <button
        ref={buttonRef}
        className="inline-flex h-10 min-w-0 items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 text-left text-xs text-emerald-100 transition hover:border-emerald-200/50 hover:bg-emerald-400/15"
        onClick={() => {
          updateMenuPosition();
          setOpen((value) => !value);
        }}
        type="button"
      >
        <AccountAvatar label={label} imageUrl={user.profileImageUrl} />
        <span className={`min-w-0 ${compact ? "hidden" : "hidden xl:block"}`}>
          <span className="block truncate font-semibold">{label}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <PlanBadge compact entitlement={entitlement} />
            <span className="text-[11px] text-emerald-200/80">{plan.shortLabel}</span>
          </span>
        </span>
        {compact ? <PlanBadge compact entitlement={entitlement} /> : null}
      </button>
      {open && mounted
        ? createPortal(
            <div
              ref={menuRef}
              className="z-[9000] rounded-2xl border border-white/10 bg-slate-950/95 p-2 text-xs text-slate-300 shadow-2xl shadow-black/40 ring-1 ring-cyan-300/10 backdrop-blur-xl"
              style={menuStyle}
            >
              <div className="border-b border-white/10 px-3 py-2">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <div className="truncate font-semibold text-slate-100">{user.email}</div>
                  <PlanBadge entitlement={entitlement} />
                </div>
                <div className="mt-1 text-[11px] text-slate-500">{profile}</div>
              </div>
              <MenuLink href="/account" label="Profile" onSelect={() => setOpen(false)} />
              <MenuLink href="/account#risk-profile" label="Risk Profile" onSelect={() => setOpen(false)} />
              <button
                className="mt-1 w-full rounded-xl px-3 py-2 text-left text-rose-200 transition hover:bg-rose-400/10"
                onClick={() => void handleLogout()}
                type="button"
              >
                Logout
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function PlanBadge({ compact = false, entitlement }: { compact?: boolean; entitlement: CurrentUserEntitlement }) {
  const status = planStatus(entitlement);
  return (
    <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 font-semibold ${compact ? "text-[10px]" : "text-[11px]"} ${status.className}`}>
      {status.label}
    </span>
  );
}

function AccountAvatar({ imageUrl, label }: { imageUrl: string | null; label: string }) {
  if (imageUrl) {
    return <img alt="" className="h-8 w-8 rounded-full border border-white/10 object-cover" src={imageUrl} />;
  }
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-emerald-200/20 bg-emerald-300/15 font-mono text-[11px] font-black">
      {label.slice(0, 2).toUpperCase()}
    </span>
  );
}

function MenuLink({ href, label, onSelect }: { href: string; label: string; onSelect: () => void }) {
  return (
    <Link className="mt-1 block w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/[0.06] hover:text-cyan-100" href={href} onClick={onSelect}>
      {label}
    </Link>
  );
}

function planStatus(entitlement: CurrentUserEntitlement): { className: string; label: string; shortLabel: string } {
  if (entitlement.isAdmin || entitlement.plan === "admin") {
    return {
      className: "border-fuchsia-300/35 bg-fuchsia-400/10 text-fuchsia-100",
      label: "Admin",
      shortLabel: "Admin account",
    };
  }
  if (entitlement.isPremium || entitlement.plan === "premium") {
    return {
      className: "border-cyan-300/35 bg-cyan-400/10 text-cyan-100",
      label: "Premium",
      shortLabel: "Premium account",
    };
  }
  return {
    className: "border-slate-500/35 bg-white/[0.04] text-slate-200",
    label: "Free",
    shortLabel: "Free account",
  };
}

function profileMeta(user: CurrentUser) {
  if (user.riskExperienceLevel) return `${titleCase(user.riskExperienceLevel)} risk profile`;
  if (user.onboardingCompleted) return "Profile complete";
  if (!user.displayName?.trim()) return "Profile setup available";
  return "Account saved";
}

function titleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
