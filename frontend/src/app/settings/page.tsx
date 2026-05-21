import { BellRing, BrainCircuit, Eye, LockKeyhole, Settings2, ShieldCheck, SlidersHorizontal, UserRound } from "lucide-react";
import { AccountSignInCta } from "@/components/account/AccountPageActions";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { UtilityCard, UtilityHero, UtilityPageStack, UtilityStatusRows, UtilityTimeline } from "@/components/utility/CinematicUtilitySurface";
import { getAlertOverview } from "@/lib/alerts";
import { getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";
import { readUserMemorySettings } from "@/lib/server/user-memory-settings";
import { readUserWatchlist } from "@/lib/server/user-watchlist";
import { DEFAULT_USER_MEMORY_SETTINGS } from "@/lib/trading/user-memory-settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const entitlement = await getEntitlement();
  const user = entitlement.user;

  if (!user) {
    return (
      <TerminalShell>
        <UtilityPageStack>
          <UtilityHero
            eyebrow="Adaptive Settings"
            metrics={[
              { detail: "Sign in to load account-specific preferences.", label: "Session", tone: "amber", value: "Required" },
              { detail: "Settings never need brokerage credentials.", label: "Privacy", tone: "emerald", value: "Protected" },
            ]}
            right={
              <UtilityCard eyebrow="Protected settings" icon={<LockKeyhole className="h-5 w-5" />} title="Sign in to tune TradeVeto" tone="cyan">
                <p className="text-sm leading-6 text-slate-400">Personalized risk style, notification defaults, memory controls, and workflow density appear after authentication.</p>
                <div className="mt-5">
                  <AccountSignInCta />
                </div>
              </UtilityCard>
            }
            subtitle="Settings now behave like an intelligence control surface: account state, memory, alerts, density, and privacy are presented as one coherent operating map."
            title="Tune the intelligence environment"
            tone="cyan"
          />
        </UtilityPageStack>
      </TerminalShell>
    );
  }

  const [watchlist, memorySettings, alertCount] = await Promise.all([
    readUserWatchlist(user.id).catch(() => []),
    readUserMemorySettings(user.id).catch(() => DEFAULT_USER_MEMORY_SETTINGS),
    getAlertOverview({ stateLimit: 0, userId: user.id }).then((overview) => overview.activeCount).catch(() => null),
  ]);

  return (
    <TerminalShell>
      <UtilityPageStack>
        <UtilityHero
          eyebrow="Adaptive Settings"
          metrics={[
            { detail: hasPremiumAccess(entitlement) ? "Premium intelligence surfaces are unlocked." : "Some dense intelligence surfaces remain gated.", label: "Access", tone: hasPremiumAccess(entitlement) ? "emerald" : "amber", value: entitlement.plan.toUpperCase() },
            { detail: `${watchlist.length.toLocaleString()} symbols can influence watchlist-aware defaults.`, label: "Watchlist", tone: watchlist.length ? "cyan" : "amber", value: watchlist.length.toLocaleString() },
            { detail: alertCount === null ? "Alert count is unavailable in this request." : "Enabled rules can power notifications.", label: "Alerts", tone: alertCount ? "violet" : "amber", value: alertCount === null ? "N/A" : alertCount.toLocaleString() },
            { detail: memorySettings.behavioralLearningEnabled ? "Decision memory can personalize workflow guidance." : "Behavioral learning is paused.", label: "Memory", tone: memorySettings.behavioralLearningEnabled ? "emerald" : "amber", value: memorySettings.behavioralLearningEnabled ? "On" : "Paused" },
          ]}
          right={<SettingsCognitionPanel alertCount={alertCount} learningEnabled={memorySettings.behavioralLearningEnabled} watchlistCount={watchlist.length} />}
          subtitle="Control how TradeVeto prioritizes attention, protects privacy, presents density, and guides account-specific workflows."
          title="Settings command surface"
          tone="violet"
        />

        <div className="grid gap-4 xl:grid-cols-4">
          <UtilityCard action="Open Terminal personalization" eyebrow="Risk posture" href="/terminal#workspace-personalization" icon={<SlidersHorizontal className="h-5 w-5" />} title="Risk and density defaults" tone="cyan">
            <p className="text-sm leading-6 text-slate-400">Tune risk style, visible module density, quick access priorities, and workflow defaults from the live terminal context.</p>
          </UtilityCard>
          <UtilityCard action="Open alert manager" eyebrow="Monitoring" href="/alerts" icon={<BellRing className="h-5 w-5" />} title="Notification intelligence" tone="amber">
            <p className="text-sm leading-6 text-slate-400">Review alert rules, delivery behavior, watchlist impact, and cooldown posture without turning notifications into noise.</p>
          </UtilityCard>
          <UtilityCard action="Open Account privacy" eyebrow="Memory" href="/account#decision-memory" icon={<BrainCircuit className="h-5 w-5" />} title="Decision memory controls" tone="violet">
            <p className="text-sm leading-6 text-slate-400">Enable or pause behavioral learning, journal coaching, and export controls from the account memory section.</p>
          </UtilityCard>
          <UtilityCard action="Open Support" eyebrow="Help" href="/support" icon={<ShieldCheck className="h-5 w-5" />} title="Support and trust loop" tone="emerald">
            <p className="text-sm leading-6 text-slate-400">Troubleshoot stale data, billing navigation, account access, alerts, and product workflows inside the same research boundary.</p>
          </UtilityCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <UtilityCard eyebrow="Current settings state" icon={<Settings2 className="h-5 w-5" />} title="Adaptive operating map" tone="cyan">
            <UtilityStatusRows
              items={[
                {
                  detail: entitlement.legalStatus.allAccepted ? "Legal gate is clear." : "Review Terms, Privacy Policy, and Risk Disclosure from Account.",
                  label: "Legal readiness",
                  tone: entitlement.legalStatus.allAccepted ? "emerald" : "amber",
                  value: entitlement.legalStatus.allAccepted ? "Accepted" : "Required",
                },
                {
                  detail: user.emailVerified ? "Email can support account notices and billing events." : "Verify email to reduce account friction.",
                  label: "Identity readiness",
                  tone: user.emailVerified ? "emerald" : "amber",
                  value: user.emailVerified ? "Verified" : "Pending",
                },
                {
                  detail: memorySettings.journalCoachingEnabled ? "Decision journal coaching can appear when evidence supports it." : "Journal coaching is paused but saved entries remain private.",
                  label: "Coaching",
                  tone: memorySettings.journalCoachingEnabled ? "cyan" : "amber",
                  value: memorySettings.journalCoachingEnabled ? "Enabled" : "Paused",
                },
              ]}
            />
          </UtilityCard>
          <UtilityCard eyebrow="Workflow-aware onboarding" icon={<UserRound className="h-5 w-5" />} title="Recommended next settings moves" tone="violet">
            <UtilityTimeline
              items={[
                { detail: watchlist.length ? "Watchlist-aware intelligence is active. Review alerts for the symbols you revisit most." : "Add 3-5 symbols so Terminal, Feed, and Alerts have personal context.", label: "Activate watchlist context", tone: watchlist.length ? "emerald" : "amber" },
                { detail: alertCount ? "Enabled alerts exist. Audit cooldowns and delivery choices so the system stays non-spammy." : "Create one context alert for a watched symbol before increasing notification volume.", label: "Tune monitoring", tone: alertCount ? "cyan" : "amber" },
                { detail: memorySettings.behavioralLearningEnabled ? "Decision memory can support personalized briefings. Keep privacy settings aligned with your comfort level." : "Behavioral learning is paused. Re-enable only if you want workflow-aware guidance.", label: "Set memory boundary", tone: memorySettings.behavioralLearningEnabled ? "violet" : "amber" },
              ]}
            />
          </UtilityCard>
        </div>
      </UtilityPageStack>
    </TerminalShell>
  );
}

function SettingsCognitionPanel({ alertCount, learningEnabled, watchlistCount }: { alertCount: number | null; learningEnabled: boolean; watchlistCount: number }) {
  return (
    <UtilityCard eyebrow="Settings cognition" icon={<Eye className="h-5 w-5" />} title="What the system can adapt" tone="violet">
      <div className="grid gap-3">
        <SettingNode label="Watchlist focus" value={watchlistCount ? `${watchlistCount} symbols` : "Add symbols"} tone={watchlistCount ? "cyan" : "amber"} />
        <SettingNode label="Alert behavior" value={alertCount === null ? "Unavailable" : alertCount ? `${alertCount} rules` : "No active rules"} tone={alertCount ? "emerald" : "amber"} />
        <SettingNode label="Decision memory" value={learningEnabled ? "Learning on" : "Learning paused"} tone={learningEnabled ? "violet" : "amber"} />
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">Settings change presentation and workflow guidance. They do not create financial advice or connect to broker execution.</p>
    </UtilityCard>
  );
}

function SettingNode({ label, tone, value }: { label: string; tone: "amber" | "cyan" | "emerald" | "violet"; value: string }) {
  const classes = tone === "emerald"
    ? "border-emerald-300/20 text-emerald-100"
    : tone === "violet"
      ? "border-violet-300/20 text-violet-100"
      : tone === "amber"
        ? "border-amber-300/20 text-amber-100"
        : "border-cyan-300/20 text-cyan-100";
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/42 p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className={`mt-2 w-fit rounded-full border bg-white/[0.045] px-2.5 py-1 text-xs font-black ${classes}`}>{value}</div>
    </div>
  );
}
