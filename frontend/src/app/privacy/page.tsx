import { TerminalShell } from "@/components/terminal/TerminalShell";

export default function PrivacyPage() {
  return (
    <TerminalShell>
      <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-black/30 ring-1 ring-white/5 backdrop-blur-xl">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Privacy</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">Privacy Policy</h1>
        <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
          <p>Market Alpha Scanner stores account, session, watchlist, risk profile, paper trading, alert, and subscription entitlement data needed to operate the service.</p>
          <p>Passwords are stored as hashes. Session cookies are httpOnly. We do not sell user account data. Operational logs may be retained for security, abuse prevention, reliability, and support.</p>
          <p>Do not enter brokerage credentials or sensitive financial account information. Live broker integrations are not enabled.</p>
        </div>
      </section>
    </TerminalShell>
  );
}
