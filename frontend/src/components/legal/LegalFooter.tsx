import Link from "next/link";

export function LegalFooter() {
  return (
    <footer className="mt-8 flex flex-wrap items-center gap-2 border-t border-white/10 pt-5 text-xs text-slate-500">
      <Link className="inline-flex min-h-9 items-center rounded-full px-2 hover:text-cyan-200" href="/terms">Terms</Link>
      <Link className="inline-flex min-h-9 items-center rounded-full px-2 hover:text-cyan-200" href="/privacy">Privacy</Link>
      <Link className="inline-flex min-h-9 items-center rounded-full px-2 hover:text-cyan-200" href="/risk-disclosure">Risk Disclosure</Link>
      <Link className="inline-flex min-h-9 items-center rounded-full px-2 hover:text-cyan-200" href="/support">Support</Link>
      <span>Not financial advice.</span>
    </footer>
  );
}
