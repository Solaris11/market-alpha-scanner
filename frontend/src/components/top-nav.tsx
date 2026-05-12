"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { NotificationBell } from "./notifications/NotificationBell";

const NAV_ITEMS = [
  { href: "/terminal", label: "Terminal" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/paper", label: "Paper" },
  { href: "/strategy-labs", label: "Labs" },
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
    <nav className="flex max-w-full items-center gap-4 overflow-x-auto border-b border-white/10 pb-0 text-xs text-slate-400 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-[38px] shrink-0 items-center border-b-2 px-0.5 py-2 font-semibold transition-colors duration-200 ${active ? "border-cyan-300 text-cyan-100" : "border-transparent text-slate-400 hover:border-white/25 hover:text-slate-100"}`}
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
