import Link from "next/link";
import type { ReactNode } from "react";
import type { QueryResultRow } from "pg";
import { AccountLogoutButton, AccountSignInCta } from "@/components/account/AccountPageActions";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { getAlertOverview } from "@/lib/alerts";
import { getCurrentUser } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";
import { readUserWatchlist } from "@/lib/server/user-watchlist";
import { DEFAULT_USER_RISK_PROFILE, normalizeRiskProfile, type UserRiskProfile } from "@/lib/trading/risk-veto";

export const dynamic = "force-dynamic";

type RiskProfileRow = QueryResultRow & {
  allow_override: boolean;
  max_daily_loss: string | number | null;
  max_risk_per_trade_percent: string | number;
  max_sector_positions: string | number;
};

type RiskProfileResult = {
  exists: boolean;
  profile: UserRiskProfile;
};

export default async function AccountPage() {
  const user = await getCurrentUser().catch(() => null);

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

  const [riskProfile, watchlist, enabledAlertCount] = await Promise.all([
    readRiskProfile(user.id),
    readWatchlist(user.id),
    readEnabledAlertCount(user.id),
  ]);

  return (
    <TerminalShell>
      <div className="space-y-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/55 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Account</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-50">Profile and saved settings</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Manage the account details and trading preferences used across Market Alpha Scanner.</p>
          </div>
          <span className="w-fit rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">Account saved</span>
        </header>

        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <AccountSection title="Profile">
            <dl className="grid gap-3 sm:grid-cols-2">
              <InfoItem label="Display name" value={emptyText(user.displayName)} />
              <InfoItem label="Email" value={user.email} />
              <InfoItem label="Timezone" value={emptyText(user.timezone)} />
              <InfoItem label="Risk experience" value={formatTitle(user.riskExperienceLevel)} />
              <InfoItem label="Registration date" value={formatDate(user.createdAt)} />
              <InfoItem label="Last login" value={formatDate(user.lastLoginAt)} />
              <InfoItem label="Account state" value={formatTitle(user.state) || "Active"} />
              <InfoItem label="Email status" value={user.emailVerified ? "Verified" : "Not verified yet"} />
            </dl>
          </AccountSection>

          <AccountSection title="Subscription">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current plan</div>
              <div className="mt-2 text-2xl font-semibold text-slate-50">Private Beta / Free</div>
              <button className="mt-4 cursor-not-allowed rounded-full border border-white/10 px-4 py-2 text-sm text-slate-500" disabled type="button">
                Billing will be available in Phase 5.
              </button>
            </div>
          </AccountSection>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <AccountSection title="Security">
            <PlaceholderItem title="Change password" text="Password changes will be managed from this page." />
            <PlaceholderItem title="Email verification" text={user.emailVerified ? "Your email address is verified." : "Email verification is not required for your current plan."} />
            <PlaceholderItem title="Two-factor authentication" text="Two-factor authentication will be available before live broker integrations." />
          </AccountSection>

          <AccountSection id="risk-profile" title="Risk Profile">
            <dl className="grid gap-3">
              <InfoItem label="Max risk per trade" value={formatPercent(riskProfile.profile.maxRiskPerTradePercent)} />
              <InfoItem label="Max daily loss" value={riskProfile.profile.maxDailyLoss === null ? "Not set" : formatMoney(riskProfile.profile.maxDailyLoss)} />
              <InfoItem label="Max sector positions" value={formatInteger(riskProfile.profile.maxSectorExposure)} />
              <InfoItem label="Allow override" value={riskProfile.profile.allowOverride ? "Allowed" : "Blocked"} />
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
              <button className="cursor-not-allowed rounded-full border border-white/10 px-4 py-2 text-sm text-slate-500" disabled type="button">
                Delete account
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">Account deletion controls will be available after self-service account management is enabled.</p>
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
      </div>
    </TerminalShell>
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

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-slate-100">{value}</dd>
    </div>
  );
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
    return <p className="mt-4 text-sm text-slate-500">No saved symbols yet.</p>;
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
        SELECT max_risk_per_trade_percent, max_daily_loss, max_sector_positions, allow_override
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
        maxDailyLoss: nullableNumber(row.max_daily_loss),
        maxPositionSizePercent: null,
        maxRiskPerTradePercent: numberValue(row.max_risk_per_trade_percent, DEFAULT_USER_RISK_PROFILE.maxRiskPerTradePercent),
        maxSectorExposure: numberValue(row.max_sector_positions, DEFAULT_USER_RISK_PROFILE.maxSectorExposure),
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
