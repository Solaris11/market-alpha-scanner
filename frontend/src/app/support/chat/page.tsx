import { SupportChatBox } from "@/components/support/SupportActions";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { SUPPORT_DISCLAIMER } from "@/lib/support/content";

export const dynamic = "force-dynamic";

export default function SupportChatPage() {
  return (
    <TerminalShell>
      <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">AI Support Chat</div>
        <h1 className="mt-2 text-3xl font-semibold text-slate-50">Product support assistant</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Ask about using the product, billing navigation, alerts, paper trading, or troubleshooting. Financial advice requests are blocked.</p>
        <p className="mt-3 text-xs text-amber-100">{SUPPORT_DISCLAIMER}</p>
        <div className="mt-6">
          <SupportChatBox />
        </div>
      </section>
    </TerminalShell>
  );
}
