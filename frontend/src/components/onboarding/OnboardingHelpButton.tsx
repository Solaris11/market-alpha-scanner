"use client";

import { usePathname, useRouter } from "next/navigation";
import { markOnboardingReplayPending, replayMarketOnboarding } from "./MarketOnboarding";

export function OnboardingHelpButton() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <button
      aria-label="Replay onboarding"
      className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-sm font-black text-slate-300 transition hover:border-cyan-300/40 hover:bg-cyan-400/10 hover:text-cyan-100"
      onClick={() => {
        if (pathname !== "/terminal") {
          markOnboardingReplayPending();
          router.push("/terminal");
          return;
        }
        replayMarketOnboarding();
      }}
      title="Replay onboarding"
      type="button"
    >
      ?
    </button>
  );
}
