"use client";

import { useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function AccountMenu() {
  const { logout, user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  if (!user) return null;
  const label = user.displayName || user.email;

  return (
    <div className="relative" ref={rootRef}>
      <button
        className="flex min-w-0 items-center gap-3 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-left text-xs text-emerald-100 transition hover:border-emerald-200/50"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <AccountAvatar label={label} imageUrl={user.profileImageUrl} />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{label}</span>
          <span className="block text-[11px] text-emerald-200/80">Account saved</span>
        </span>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 p-2 text-xs text-slate-300 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="border-b border-white/10 px-3 py-2">
            <div className="truncate font-semibold text-slate-100">{user.email}</div>
            <div className="mt-1 text-[11px] text-slate-500">{profileMeta(user)}</div>
          </div>
          <MenuItem label="Profile" />
          <MenuItem label="Risk Profile" />
          <button className="mt-1 w-full rounded-xl px-3 py-2 text-left text-rose-200 transition hover:bg-rose-400/10" onClick={() => void logout()} type="button">
            Logout
          </button>
        </div>
      ) : null}
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

function MenuItem({ label }: { label: string }) {
  return (
    <button className="mt-1 w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/[0.06] hover:text-cyan-100" type="button">
      {label}
    </button>
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
