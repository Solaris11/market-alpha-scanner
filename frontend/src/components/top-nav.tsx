"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { NotificationBell } from "./notifications/NotificationBell";

const NAV_ITEMS = [
  { href: "/terminal", label: "Terminal" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/paper", label: "Paper" },
  { href: "/performance", label: "Performance" },
  { href: "/history", label: "History" },
  { href: "/alerts", label: "Alerts" },
  { href: "/advanced", label: "Advanced" },
  { href: "/support", label: "Support" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav() {
  const pathname = usePathname();
  const { authenticated, entitlement } = useCurrentUser();
  const items = authenticated
    ? [...NAV_ITEMS, ...(entitlement.isAdmin ? [{ href: "/admin", label: "Admin" }] : []), { href: "/account", label: "Account" }]
    : NAV_ITEMS;

  return (
    <nav className="flex max-w-full flex-wrap items-center gap-2 text-xs text-slate-400">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            className={`max-w-full rounded-full border px-3 py-1.5 transition-all duration-200 ${
              active
                ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.18)]"
                : "border-white/10 bg-white/[0.03] hover:border-cyan-400/40 hover:bg-white/5 hover:text-cyan-100"
            }`}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
      {authenticated ? <NotificationBell /> : null}
    </nav>
  );
}
