"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/scanner", label: "Scanner" },
  { href: "/performance", label: "Performance" },
  { href: "/history", label: "History" },
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
            className={`rounded border px-3 py-1.5 transition-colors ${
              active
                ? "border-sky-400/50 bg-sky-400/10 text-sky-100"
                : "border-slate-700/70 hover:border-sky-400/40 hover:text-sky-200"
            }`}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
      <a
        className="rounded border border-slate-700/70 px-3 py-1.5 hover:border-sky-400/40 hover:text-sky-200"
        href="http://localhost:8501"
        rel="noreferrer"
        target="_blank"
      >
        Streamlit Admin
      </a>
    </nav>
  );
}
