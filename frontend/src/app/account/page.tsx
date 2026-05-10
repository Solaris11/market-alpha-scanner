import Link from "next/link";
import type { ReactNode } from "react";
import type { QueryResultRow } from "pg";
import { AccountLogoutButton, AccountSignInCta, BillingActionButton, DeleteAccountButton, LegalReviewButton, SendVerificationEmailButton } from "@/components/account/AccountPageActions";
import { UserMemoryPrivacyControls } from "@/components/account/UserMemoryPrivacyControls";
import { betaBillingCopy, parseBooleanFlag, parseTrialDays } from "@/lib/security/beta-billing";
import { billingViewState } from "@/lib/security/billing-state";
import { checkoutBlockMessage, checkoutBlockReason } from "@/lib/security/billing-readiness";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { getAlertOverview } from "@/lib/alerts";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { dbQuery } from "@/lib/server/db";
import { getFreshBillingSubscriptionForUser, type BillingSubscription } from "@/lib/server/billing";
import { getDecisionMemoryForUser } from "@/lib/server/decision-journal";
import { getEntitlement, hasPremiumAccess, type Entitlement } from "@/lib/server/entitlements";
import { getPersonalizationProfileForUser } from "@/lib/server/personalized-intelligence";
import { formatRiskExperienceLevel } from "@/lib/security/onboarding-profile";
import { readUserMemorySettings } from "@/lib/server/user-memory-settings";
import { readUserWatchlist } from "@/lib/server/user-watchlist";
import { getWorkflowEvolutionForUser } from "@/lib/server/workflow-evolution";
import { buildUserMemoryActivation } from "@/lib/trading/user-memory-activation";
import { DEFAULT_USER_MEMORY_SETTINGS } from "@/lib/trading/user-memory-settings";
import { DEFAULT_USER_RISK_PROFILE, normalizePersonalityProfile, normalizePreferenceLevel, normalizeRiskProfile, type UserRiskProfile } from "@/lib/trading/risk-veto";

export const dynamic = "force-dynamic";

type RiskProfileRow = QueryResultRow & {
  allow_override: boolean;
  asymmetry_preference: string | number | null;
  continuation_preference: string | number | null;
  drawdown_tolerance: string | number | null;
  event_preference: string | number | null;
  max_daily_loss: string | number | null;
  max_risk_per_trade_percent: string | number;
  max_sector_positions: string | number;
  momentum_preference: string | number | null;
  personality_confidence: string | number | null;
  personality_profile: string | null;
  preferred_reward_level: string | null;
  preferred_risk_level: string | null;
  pullback_preference: string | number | null;
  volatility_tolerance: string | number | null;
};

type RiskProfileResult = {
  exists: boolean;
  profile: UserRiskProfile;
};

export default async function AccountPage() {
  const entitlement = await getEntitlement();
  const user = entitlement.user;
  const betaBilling = {
    allowPromotionCodes: parseBooleanFlag(process.env.STRIPE_ALLOW_PROMOTION_CODES),
    trialDays: parseTrialDays(process.env.STRIPE_BETA_TRIAL_DAYS),
  };

  if (!user) {
    return (
      <TerminalShell>
        <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl">
          <div className="max-w-2xl">
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Account</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-50">Sign in to manage your account</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Your saved watchlist, risk rules, alert settings, and account details appear here once you are signed in.</p>
            <div className="mt-5">
              <AccountSignInCta />
            </div>
          </div>
        </section>
      </TerminalShell>
    );
  }

  const [riskProfile, watchlist, enabledAlertCount, billingSubscription, decisionMemory, memorySettings, personalizationProfile] = await Promise.all([
    readRiskProfile(user.id),
    readWatchlist(user.id),
    readEnabledAlertCount(user.id),
    getFreshBillingSubscriptionForUser(user.id).catch(() => null),
    getDecisionMemoryForUser(user.id).then((context) => context.memory).catch(() => null),
    readUserMemorySettings(user.id).catch(() => DEFAULT_USER_MEMORY_SETTINGS),
    getPersonalizationProfileForUser(user.id).catch(() => null),
  ]);
  const workflowEvolution = hasPremiumAccess(entitlement)
    ? await (async () => {
        const adapter = new ScannerDataAdapter();
        const rows = await adapter.getOverviewSignals();
        return getWorkflowEvolutionForUser(user.id, rows, { surface: "opportunities", watchlistSymbols: watchlist });
      })().catch(() => null)
    : null;
  const memoryActivation = buildUserMemoryActivation({
    memory: decisionMemory,
    profile: personalizationProfile,
    settings: memorySettings,
    watchlistSymbols: watchlist,
    workflowEvolution,
  });

  return (
    <TerminalShell>
      <div className="space-y-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/55 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Account</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-50">Profile and saved settings</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Manage the account details and trading preferences used across TradeVeto.</p>
          </div>
          <span className="w-fit rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">Account saved</span>
        </header>

        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <AccountSection title="Profile">
            <dl className="grid gap-3 sm:grid-cols-2">
              <InfoItem label="Display name" value={emptyText(user.displayName)} />
              <InfoItem label="Email" value={user.email} />
              <InfoItem label="Timezone" value={formatTimezone(user.timezone)} />
              <InfoItem label="Risk experience" value={formatRiskExperienceLevel(user.riskExperienceLevel)} />
              <InfoItem label="Registration date" value={formatDate(user.createdAt)} />
              <InfoItem label="Last login" value={formatDate(user.lastLoginAt)} />
              <InfoItem label="Account state" value={formatTitle(user.state) || "Active"} />
              <InfoItem
                label="Legal status"
                subtext={entitlement.legalStatus.allAccepted ? undefined : "Terms, Privacy Policy, and Risk Disclosure must be accepted before upgrading."}
                value={entitlement.legalStatus.allAccepted ? "Accepted" : "Required"}
              />
              <InfoItem
                label="Email status"
                subtext={user.emailVerified ? undefined : "Verify this email address before upgrading to Premium."}
                value={user.emailVerified ? "Verified" : "Not verified"}
              />
            </dl>
          </AccountSection>

          <AccountSection title="Subscription">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current plan</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-2xl font-semibold text-slate-50">{planLabel(entitlement)}</span>
                <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${planBadgeClass(entitlement)}`}>{planBadgeText(entitlement)}</span>
              </div>
              <div className="mt-4">
                <BillingControl billingSubscription={billingSubscription} entitlement={entitlement} />
              </div>
              <div className="mt-3 rounded-xl border border-cyan-300/15 bg-cyan-400/[0.055] px-3 py-2 text-xs leading-5 text-cyan-50/85">
                {betaBillingCopy(betaBilling)} You can cancel through Stripe before renewal.
              </div>
              {billingSubscription ? <SubscriptionState isPremium={entitlement.isPremium} subscription={billingSubscription} /> : null}
              <BillingTrustChecklist allowPromotionCodes={betaBilling.allowPromotionCodes} trialDays={betaBilling.trialDays} />
              <p className="mt-3 text-xs leading-5 text-slate-500">Payments are securely processed by Stripe.</p>
            </div>
          </AccountSection>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <AccountSection title="Security">
            <PlaceholderItem title="Change password" text="Password changes will be managed from this page." />
            <div className="mt-3 first:mt-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
              <div className="text-sm font-semibold text-slate-100">Email verification</div>
              <p className="mt-1 text-xs leading-5 text-slate-500">{user.emailVerified ? "Your email address is verified." : "Send a verification link to unlock billing upgrades."}</p>
              {!user.emailVerified ? <div className="mt-3"><SendVerificationEmailButton /></div> : null}
            </div>
            {!entitlement.legalStatus.allAccepted ? (
              <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/[0.06] px-3 py-3">
                <div className="text-sm font-semibold text-amber-100">Legal documents required</div>
                <p className="mt-1 text-xs leading-5 text-amber-100/75">Accept the latest Terms, Privacy Policy, and Risk Disclosure before using paid features.</p>
                <div className="mt-3"><LegalReviewButton /></div>
              </div>
            ) : null}
            <PlaceholderItem title="Two-factor authentication" text="Two-factor authentication will be available before live broker integrations." />
          </AccountSection>

          <AccountSection id="risk-profile" title="Risk Profile">
            <dl className="grid gap-3">
              <InfoItem label="Max risk per trade" value={formatPercent(riskProfile.profile.maxRiskPerTradePercent)} />
              <InfoItem label="Max daily loss" value={riskProfile.profile.maxDailyLoss === null ? "Not set" : formatMoney(riskProfile.profile.maxDailyLoss)} />
              <InfoItem label="Max sector positions" value={formatInteger(riskProfile.profile.maxSectorExposure)} />
              <InfoItem label="Allow override" value={riskProfile.profile.allowOverride ? "Allowed" : "Blocked"} />
              <InfoItem label="Personality" value={formatTitle(riskProfile.profile.personalityProfile)} />
              <InfoItem label="Preference" value={`${formatTitle(riskProfile.profile.preferredRiskLevel)} risk / ${formatTitle(riskProfile.profile.preferredRewardLevel)} reward`} />
            </dl>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15" href="/terminal">
                Edit risk settings
              </Link>
              <span className="text-xs text-slate-500">{riskProfile.exists ? "Saved to your account" : "Using default risk rules"}</span>
            </div>
          </AccountSection>

          <AccountSection title="Account Actions">
            <div className="flex flex-wrap items-center gap-3">
              <AccountLogoutButton />
            </div>
            <div className="mt-5 rounded-xl border border-rose-300/20 bg-rose-400/[0.05] p-4">
              <div className="text-sm font-semibold text-rose-100">Danger zone</div>
              <p className="mt-1 text-xs leading-5 text-rose-100/75">This permanently deletes your TradeVeto account data. Active subscriptions must be canceled first.</p>
              <div className="mt-3"><DeleteAccountButton /></div>
            </div>
          </AccountSection>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <AccountSection title="Watchlist Summary">
            <div className="text-3xl font-semibold text-slate-50">{watchlist.length.toLocaleString()}</div>
            <div className="mt-1 text-sm text-slate-400">saved symbol{watchlist.length === 1 ? "" : "s"}</div>
            <SymbolPreview symbols={watchlist} />
            <Link className="mt-4 inline-flex rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15" href="/opportunities?tab=watchlist">
              Open watchlist
            </Link>
          </AccountSection>

          <AccountSection title="Alerts Summary">
            {enabledAlertCount === null ? (
              <p className="text-sm leading-6 text-slate-400">Alert counts are not available yet. Your alert rules remain available from the Alerts page.</p>
            ) : (
              <>
                <div className="text-3xl font-semibold text-slate-50">{enabledAlertCount.toLocaleString()}</div>
                <div className="mt-1 text-sm text-slate-400">enabled alert rule{enabledAlertCount === 1 ? "" : "s"}</div>
              </>
            )}
            <Link className="mt-4 inline-flex rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15" href="/alerts">
              Open alerts
            </Link>
          </AccountSection>
        </div>

        <AccountSection title="Decision Memory">
          {decisionMemory ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
                <div>
                  <div className="text-3xl font-semibold text-slate-50">{decisionMemory.journalCount.toLocaleString()}</div>
                  <div className="mt-1 text-sm text-slate-400">journaled decision{decisionMemory.journalCount === 1 ? "" : "s"}</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <InfoItem label="Patient decisions" value={decisionMemory.patientDecisionCount.toLocaleString()} />
                    <InfoItem label="Chase-risk notes" value={decisionMemory.chaseCount.toLocaleString()} />
                    <InfoItem label="Learning" value={memorySettings.behavioralLearningEnabled ? "Enabled" : "Disabled"} />
                    <InfoItem label="Coaching" value={memorySettings.journalCoachingEnabled ? "Enabled" : "Paused"} />
                  </div>
                </div>
                <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/[0.055] p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Personalized daily briefing</div>
                  <h4 className="mt-2 text-lg font-semibold text-slate-50">{memoryActivation.dailyBriefing.headline}</h4>
                  <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-300">
                    {memoryActivation.dailyBriefing.bullets.map((note) => <li key={note}>- {note}</li>)}
                  </ul>
                  <p className="mt-3 text-xs leading-5 text-slate-500">{memoryActivation.dailyBriefing.privacyNote}</p>
                  <Link className="mt-4 inline-flex rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15" href="/terminal">
                    Open decision workspace
                  </Link>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <MemoryGrid title="What TradeVeto Remembers" items={memoryActivation.transparency.map((item) => ({ label: item.title, value: item.detail }))} />
                <MemoryGrid title="Personalized Insights" items={memoryActivation.insights.map((item) => ({ label: `${item.title} · ${item.evidenceLabel}`, value: item.detail }))} />
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Watchlist revisit intelligence</div>
                  {memoryActivation.watchlistRevisit.length ? (
                    <div className="mt-3 grid gap-2">
                      {memoryActivation.watchlistRevisit.map((item) => (
                        <Link className="rounded-xl border border-white/10 bg-slate-950/35 p-3 transition hover:border-cyan-300/35 hover:bg-white/[0.055]" href={`/symbol/${item.symbol}`} key={`${item.symbol}:${item.title}:${item.state}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono text-sm font-black text-slate-50">{item.symbol}</span>
                            <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${memoryPriorityClass(item.priority)}`}>{item.priority}</span>
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-100">{item.title}</div>
                          <div className="mt-1 text-[11px] text-cyan-100">{item.state}</div>
                          <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-slate-400">Add symbols to your watchlist to start revisit intelligence.</p>
                  )}
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Privacy summary</div>
                  <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-300">
                    {memoryActivation.privacySummary.map((note) => <li key={note}>- {note}</li>)}
                  </ul>
                  <div className="mt-4">
                    <UserMemoryPrivacyControls initialSettings={memorySettings} memoryAvailable={decisionMemory.journalCount > 0 || Boolean(workflowEvolution?.lastSeenAt)} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/[0.055] p-4">
              <div className="text-sm font-semibold text-slate-100">Start with one saved decision</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Decision memory appears after you journal a watch, wait, avoid, entry, exit, shock watch, or pullback watch from a symbol page. Start with one symbol you already follow.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15" href="/opportunities">
                  Find a symbol
                </Link>
                <Link className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/35 hover:text-cyan-100" href="/terminal">
                  Open starter workflow
                </Link>
              </div>
            </div>
          )}
        </AccountSection>
      </div>
    </TerminalShell>
  );
}

function planLabel(entitlement: Entitlement): string {
  if (entitlement.isAdmin || entitlement.plan === "admin") return "Private Beta / Admin";
  if (entitlement.isPremium || entitlement.plan === "premium") return "Private Beta / Premium";
  return "Private Beta / Free";
}

function planBadgeText(entitlement: Entitlement): string {
  if (entitlement.isAdmin || entitlement.plan === "admin") return "Admin";
  if (entitlement.isPremium || entitlement.plan === "premium") return "Premium";
  return "Free";
}

function planBadgeClass(entitlement: Entitlement): string {
  if (entitlement.isAdmin || entitlement.plan === "admin") return "border-fuchsia-300/35 bg-fuchsia-400/10 text-fuchsia-100";
  if (entitlement.isPremium || entitlement.plan === "premium") return "border-cyan-300/35 bg-cyan-400/10 text-cyan-100";
  return "border-slate-500/35 bg-white/[0.04] text-slate-200";
}

function BillingControl({ billingSubscription, entitlement }: { billingSubscription: BillingSubscription | null; entitlement: Entitlement }) {
  if (entitlement.isAdmin) {
    return (
      <button className="cursor-not-allowed rounded-full border border-white/10 px-4 py-2 text-sm text-slate-500" disabled type="button">
        Admin access managed internally
      </button>
    );
  }

  const billingState = billingViewState({ isPremium: entitlement.isPremium, subscription: billingSubscription });
  if (billingState.state === "cancel_scheduled" && billingSubscription?.stripeCustomerId) {
    return (
      <div className="flex flex-wrap gap-2">
        <BillingActionButton label="Manage Subscription" mode="portal" />
        <BillingActionButton label="Renew Subscription" mode="portal" />
      </div>
    );
  }

  if (billingState.actionMode === "portal") {
    return <BillingActionButton label={billingState.actionLabel ?? undefined} mode="portal" />;
  }

  if (billingState.actionMode === null && billingState.helper) {
    return <p className="text-xs leading-5 text-slate-400">{billingState.helper}</p>;
  }

  const user = entitlement.user;
  const blockReason = checkoutBlockReason({ emailVerified: Boolean(user?.emailVerified), legalAccepted: entitlement.legalStatus.allAccepted });
  const blockMessage = checkoutBlockMessage(blockReason);
  if (blockMessage) {
    return <BillingActionButton disabledReason={blockMessage} mode="checkout" />;
  }

  return <BillingActionButton mode="checkout" />;
}

function SubscriptionState({ isPremium, subscription }: { isPremium: boolean; subscription: BillingSubscription }) {
  const state = billingViewState({ isPremium, subscription });
  if (state.statusText) {
    return (
      <div className="mt-3">
        <p className={`text-xs leading-5 ${state.state === "past_due" ? "text-rose-100" : state.state === "cancel_scheduled" ? "text-amber-100" : "text-slate-300"}`}>{state.statusText}</p>
        {state.accessText ? <p className="mt-1 text-xs font-semibold leading-5 text-amber-100">{state.accessText}</p> : null}
        {state.helper ? <p className="mt-1 text-xs leading-5 text-slate-500">{state.helper}</p> : null}
      </div>
    );
  }
  if (state.helper) {
    return <p className="mt-3 text-xs leading-5 text-slate-500">{state.helper}</p>;
  }
  return null;
}

function BillingTrustChecklist({ allowPromotionCodes, trialDays }: { allowPromotionCodes: boolean; trialDays: number | null }) {
  const items = [
    trialDays ? `${trialDays}-day trial is shown before checkout confirmation.` : "No beta trial is active unless Stripe shows one before confirmation.",
    allowPromotionCodes ? "Promo-code field is available in Stripe checkout." : "No promo code is active unless Stripe displays one.",
    "Renewal price, billing cadence, and cancellation options stay visible in Stripe.",
  ];
  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Billing transparency</div>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-400">
        {items.map((item) => <li key={item}>- {item}</li>)}
      </ul>
    </div>
  );
}

function AccountSection({ children, id, title }: { children: ReactNode; id?: string; title: string }) {
  return (
    <section className="scroll-mt-6 rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl" id={id}>
      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function InfoItem({ label, subtext, value }: { label: string; subtext?: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-slate-100">{value}</dd>
      {subtext ? <p className="mt-1 text-xs leading-5 text-slate-500">{subtext}</p> : null}
    </div>
  );
}

function MemoryGrid({ items, title }: { items: Array<{ label: string; value: string }>; title: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <div className="mt-3 grid gap-2">
        {items.slice(0, 6).map((item) => (
          <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3" key={`${item.label}:${item.value}`}>
            <div className="text-xs font-semibold text-slate-100">{item.label}</div>
            <p className="mt-1 text-xs leading-5 text-slate-500">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function memoryPriorityClass(priority: "high" | "medium" | "low"): string {
  if (priority === "high") return "border-amber-300/30 bg-amber-400/10 text-amber-100";
  if (priority === "medium") return "border-cyan-300/30 bg-cyan-400/10 text-cyan-100";
  return "border-white/10 bg-white/[0.04] text-slate-300";
}

function PlaceholderItem({ text, title }: { text: string; title: string }) {
  return (
    <div className="mt-3 first:mt-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
      <div className="text-sm font-semibold text-slate-100">{title}</div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
    </div>
  );
}

function SymbolPreview({ symbols }: { symbols: string[] }) {
  if (!symbols.length) {
    return (
      <div className="mt-4 rounded-xl border border-cyan-300/15 bg-cyan-400/[0.055] p-3">
        <div className="text-sm font-semibold text-slate-100">No saved symbols yet</div>
        <p className="mt-1 text-xs leading-5 text-slate-400">Add 3-5 symbols you already care about. TradeVeto will then show what changed, where fragility moved, and which alerts matter.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15" href="/opportunities">
            Browse opportunities
          </Link>
          <Link className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/35 hover:text-cyan-100" href="/symbol/AMD">
            Try AMD
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {symbols.slice(0, 8).map((symbol) => (
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-200" key={symbol}>
          {symbol}
        </span>
      ))}
      {symbols.length > 8 ? <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-500">+{symbols.length - 8} more</span> : null}
    </div>
  );
}

async function readRiskProfile(userId: string): Promise<RiskProfileResult> {
  try {
    const result = await dbQuery<RiskProfileRow>(
      `
        SELECT
          max_risk_per_trade_percent,
          max_daily_loss,
          max_sector_positions,
          allow_override,
          personality_profile,
          preferred_risk_level,
          preferred_reward_level,
          volatility_tolerance,
          drawdown_tolerance,
          momentum_preference,
          pullback_preference,
          asymmetry_preference,
          event_preference,
          continuation_preference,
          personality_confidence
        FROM user_risk_profile
        WHERE user_id = $1
        LIMIT 1
      `,
      [userId],
    );
    const row = result.rows[0];
    if (!row) return { exists: false, profile: DEFAULT_USER_RISK_PROFILE };
    return {
      exists: true,
      profile: normalizeRiskProfile({
        allowOverride: row.allow_override,
        asymmetryPreference: nullableNumber(row.asymmetry_preference) ?? undefined,
        continuationPreference: nullableNumber(row.continuation_preference) ?? undefined,
        drawdownTolerance: nullableNumber(row.drawdown_tolerance) ?? undefined,
        eventPreference: nullableNumber(row.event_preference) ?? undefined,
        maxDailyLoss: nullableNumber(row.max_daily_loss),
        maxPositionSizePercent: null,
        maxRiskPerTradePercent: numberValue(row.max_risk_per_trade_percent, DEFAULT_USER_RISK_PROFILE.maxRiskPerTradePercent),
        maxSectorExposure: numberValue(row.max_sector_positions, DEFAULT_USER_RISK_PROFILE.maxSectorExposure),
        momentumPreference: nullableNumber(row.momentum_preference) ?? undefined,
        personalityConfidence: nullableNumber(row.personality_confidence) ?? undefined,
        personalityProfile: normalizePersonalityProfile(row.personality_profile),
        preferredRewardLevel: normalizePreferenceLevel(row.preferred_reward_level),
        preferredRiskLevel: normalizePreferenceLevel(row.preferred_risk_level),
        pullbackPreference: nullableNumber(row.pullback_preference) ?? undefined,
        volatilityTolerance: nullableNumber(row.volatility_tolerance) ?? undefined,
      }),
    };
  } catch {
    return { exists: false, profile: DEFAULT_USER_RISK_PROFILE };
  }
}

async function readWatchlist(userId: string): Promise<string[]> {
  return readUserWatchlist(userId).catch(() => []);
}

async function readEnabledAlertCount(userId: string): Promise<number | null> {
  try {
    const overview = await getAlertOverview({ stateLimit: 0, userId });
    return overview.activeCount;
  } catch {
    return null;
  }
}

function emptyText(value: string | null): string {
  const text = value?.trim();
  return text ? text : "Not set";
}

function formatTimezone(value: string | null): string {
  const text = value?.trim();
  return text ? text : "Required";
}

function formatTitle(value: string | null): string {
  const text = value?.trim();
  if (!text) return "Not set";
  return text
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatDate(value: string | null): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPercent(value: number): string {
  return `${formatNumber(value)}%`;
}

function formatInteger(value: number): string {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0)).toLocaleString("en-US");
}

function formatMoney(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return safeValue.toLocaleString("en-US", { currency: "USD", maximumFractionDigits: 0, style: "currency" });
}

function formatNumber(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return safeValue.toLocaleString("en-US", { maximumFractionDigits: Number.isInteger(safeValue) ? 0 : 2 });
}

function numberValue(value: string | number, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
