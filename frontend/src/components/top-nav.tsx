"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/terminal", label: "Terminal" },
  { href: "/", label: "Opportunities" },
  { href: "/paper", label: "Paper" },
  { href: "/performance", label: "Performance" },
  { href: "/history", label: "History" },
  { href: "/alerts", label: "Alerts" },
  { href: "/advanced", label: "Advanced" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            className={`rounded-full border px-3 py-1.5 transition-all duration-200 ${
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
    </nav>
  );
}
