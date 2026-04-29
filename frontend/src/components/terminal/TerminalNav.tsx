"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/terminal", label: "Terminal" },
  { href: "/", label: "Overview" },
  { href: "/paper", label: "Paper" },
  { href: "/performance", label: "Performance" },
  { href: "/history", label: "History" },
  { href: "/alerts", label: "Alerts" },
] as const;

export function TerminalNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-2">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
              active ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.18)]" : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/5 hover:text-slate-100"
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
