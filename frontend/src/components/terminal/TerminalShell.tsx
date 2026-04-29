import { TerminalHeader } from "./TerminalHeader";

export function TerminalShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#0b0e14_0%,#111827_42%,#1a1f2e_100%)] px-4 py-4 text-slate-100">
      <div className="mx-auto max-w-[1780px]">
        <TerminalHeader />
        {children}
      </div>
    </main>
  );
}
