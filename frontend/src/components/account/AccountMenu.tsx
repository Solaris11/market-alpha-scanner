"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function AccountMenu() {
  const router = useRouter();
  const { logout, user } = useCurrentUser();
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

  async function handleLogout() {
    setOpen(false);
    await logout();
    router.refresh();
  }

  return (
    <div>
      <button
        ref={buttonRef}
        className="flex min-w-0 items-center gap-3 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-left text-xs text-emerald-100 transition hover:border-emerald-200/50"
        onClick={() => {
          updateMenuPosition();
          setOpen((value) => !value);
        }}
        type="button"
      >
        <AccountAvatar label={label} imageUrl={user.profileImageUrl} />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{label}</span>
          <span className="block text-[11px] text-emerald-200/80">Account saved</span>
        </span>
      </button>
      {open && mounted
        ? createPortal(
            <div
              ref={menuRef}
              className="z-[9000] rounded-2xl border border-white/10 bg-slate-950/95 p-2 text-xs text-slate-300 shadow-2xl shadow-black/40 ring-1 ring-cyan-300/10 backdrop-blur-xl"
              style={menuStyle}
            >
              <div className="border-b border-white/10 px-3 py-2">
                <div className="truncate font-semibold text-slate-100">{user.email}</div>
                <div className="mt-1 text-[11px] text-slate-500">{profileMeta(user)}</div>
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

function profileMeta(user: { onboardingCompleted: boolean; riskExperienceLevel: string | null }) {
  if (user.riskExperienceLevel) return `${titleCase(user.riskExperienceLevel)} risk profile`;
  return user.onboardingCompleted ? "Profile complete" : "Profile pending";
}

function titleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
