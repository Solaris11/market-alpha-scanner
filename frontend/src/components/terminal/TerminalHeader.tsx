import { AccountPill } from "@/components/account/AccountPill";
import { BrandMark } from "@/components/brand/BrandMark";
import { CompactLegalNotice } from "@/components/legal/CompactLegalNotice";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { OnboardingHelpButton } from "@/components/onboarding/OnboardingHelpButton";
import { DesktopTerminalNav, MobileTerminalNav } from "./TerminalNav";

export function TerminalHeader() {
  return (
    <header className="visual-card visual-card-overflow-visible poster-panel sticky top-3 z-40 mb-4 rounded-[1.4rem] border border-cyan-300/18 bg-slate-950/88 px-3 py-3 shadow-2xl shadow-cyan-950/20 ring-1 ring-white/5 backdrop-blur-2xl lg:px-5 lg:py-4">
      <div className="hidden min-w-0 gap-3 xl:flex xl:flex-col">
        <div className="flex min-w-0 items-center justify-between gap-4">
          <BrandMark />
          <div className="flex min-w-0 shrink-0 items-center justify-end gap-2">
            <CompactLegalNotice className="hidden self-center 2xl:block" />
            <OnboardingHelpButton />
            <NotificationBell />
            <AccountPill compact />
          </div>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-4">
          <DesktopTerminalNav />
          <div className="flex shrink-0 items-center gap-2 2xl:hidden">
            <CompactLegalNotice className="self-center" />
          </div>
        </div>
      </div>
      <MobileTerminalNav />
    </header>
  );
}
