import Link from "next/link";
import { APP_URL as CANONICAL_APP_URL, BRAND_NAME, SUPPORT_EMAIL } from "@/lib/brand";
import { MarketingReveal } from "./MarketingReveal";

export const APP_URL = CANONICAL_APP_URL;
export const SITE_URL = CANONICAL_APP_URL;

const navItems = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
] as const;

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="marketing-surface min-h-screen overflow-hidden bg-[#030711] text-slate-100">
      <MarketingNav />
      {children}
      <MarketingFooter />
    </main>
  );
}

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#030711]/78 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link className="flex min-w-0 items-center gap-3 transition-opacity duration-200 hover:opacity-90" href="/">
          <img alt={BRAND_NAME} className="h-11 w-auto max-w-[238px] sm:h-12 sm:max-w-[262px]" src="/logo.svg" />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link className="rounded-full px-3 py-2 text-sm font-medium text-slate-300 transition-all duration-200 hover:bg-white/7 hover:text-cyan-100" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <a
          className="rounded-full border border-cyan-300/50 bg-cyan-300/12 px-4 py-2 text-sm font-bold text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.16)] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-300/20"
          href={APP_URL}
        >
          Open App
        </a>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/10 bg-black/20">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.3fr_1fr_1fr] lg:px-8">
        <div>
          <img alt={BRAND_NAME} className="h-12 w-auto max-w-[264px]" src="/logo.svg" />
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
            TradeVeto is for research and education only. It does not provide financial advice, investment recommendations, or guaranteed outcomes.
          </p>
        </div>
        <FooterGroup
          title="Product"
          links={[
            ["Features", "/features"],
            ["How It Works", "/how-it-works"],
            ["Pricing", "/pricing"],
            ["FAQ", "/faq"],
            ["Open App", APP_URL],
          ]}
        />
        <FooterGroup
          title="Company"
          links={[
            ["Risk Disclaimer", "/risk-disclaimer"],
            ["Terms", "/terms"],
            ["Privacy", "/privacy"],
            ["Support", `mailto:${SUPPORT_EMAIL}`],
          ]}
        />
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-slate-500">© {new Date().getFullYear()} {BRAND_NAME}. Research only. Not financial advice.</div>
    </footer>
  );
}

function FooterGroup({ links, title }: { links: [string, string][]; title: string }) {
  return (
    <div>
      <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">{title}</div>
      <div className="mt-4 flex flex-col gap-2">
        {links.map(([label, href]) => (
          <Link className="text-sm text-slate-300 transition-colors duration-200 hover:text-cyan-100" href={href} key={`${title}-${href}`}>
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SectionHeader({ eyebrow, title, copy }: { copy?: string; eyebrow: string; title: string }) {
  return (
    <MarketingReveal className="mx-auto max-w-3xl text-center">
      <div className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">{eyebrow}</div>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h2>
      {copy ? <p className="mt-4 text-base leading-7 text-slate-400">{copy}</p> : null}
    </MarketingReveal>
  );
}

export function MarketingCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <MarketingReveal
      className={`rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/35 hover:bg-white/[0.065] ${className}`}
    >
      {children}
    </MarketingReveal>
  );
}

export function PrimaryCta({ children = "Start Free" }: { children?: React.ReactNode }) {
  return (
    <a
      className="landing-cta inline-flex items-center justify-center rounded-full bg-cyan-300 px-6 py-3 text-sm font-black text-slate-950 shadow-[0_0_36px_rgba(34,211,238,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-cyan-200"
      href={APP_URL}
    >
      {children}
    </a>
  );
}

export function SecondaryCta({ children = "Open App" }: { children?: React.ReactNode }) {
  return (
    <a className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-slate-100 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-white/[0.075]" href={APP_URL}>
      {children}
    </a>
  );
}
