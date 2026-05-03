import Link from "next/link";

export function LegalFooter() {
  return (
    <footer className="mt-8 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5 text-xs text-slate-500">
      <Link className="hover:text-cyan-200" href="/terms">Terms</Link>
      <Link className="hover:text-cyan-200" href="/privacy">Privacy</Link>
      <Link className="hover:text-cyan-200" href="/risk-disclosure">Risk Disclosure</Link>
      <span>Not financial advice.</span>
    </footer>
  );
}
