"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResetPasswordForm } from "./ResetPasswordForm";

export function ResetPasswordPageClient({ token }: { token: string }) {
  const router = useRouter();

  if (!token) {
    return (
      <section className="terminal-panel mx-auto max-w-md rounded-md p-5 text-center">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Password Reset</div>
        <h1 className="mt-2 text-xl font-semibold text-slate-50">Reset link missing</h1>
        <p className="mt-2 text-sm text-slate-400">Request a new password reset link from the sign-in screen.</p>
        <Link className="mt-4 inline-flex rounded-full border border-cyan-300/40 px-4 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/10" href="/terminal">
          Back to terminal
        </Link>
      </section>
    );
  }

  return (
    <section className="terminal-panel mx-auto max-w-md rounded-md p-5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">TradeVeto</div>
      <h1 className="mt-2 text-xl font-semibold text-slate-50">Choose a new password</h1>
      <p className="mt-2 text-sm text-slate-400">Enter a new password for your TradeVeto account.</p>
      <div className="mt-5">
        <ResetPasswordForm onSuccess={() => router.push("/terminal")} token={token} />
      </div>
    </section>
  );
}
