"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { csrfFetch } from "@/lib/client/csrf-fetch";
import type {
  CommunityInterest,
  CommunityIntelligenceSystem,
  CommunityMetric,
  CommunityOpportunityTrend,
  CommunityReplayStudy,
  CommunitySharedWatchlist,
  CommunityThemeTrend,
} from "@/lib/trading/community-intelligence";
import { GlassPanel } from "@/components/terminal/ui/GlassPanel";
import { SectionTitle } from "@/components/terminal/ui/SectionTitle";

type CommunityApiResponse = {
  message?: string;
  ok?: boolean;
  system?: CommunityIntelligenceSystem;
};

const INTEREST_OPTIONS: Array<{ detail: string; label: string; value: CommunityInterest }> = [
  { detail: "I am monitoring this setup.", label: "Monitoring", value: "monitoring" },
  { detail: "I want to study this setup.", label: "Learning", value: "learning" },
  { detail: "Risk looks elevated.", label: "Cautious", value: "cautious" },
];

export function CommunityIntelligenceWorkspace({ initialSystem }: { initialSystem: CommunityIntelligenceSystem }) {
  const [system, setSystem] = useState(initialSystem);
  const [followSymbol, setFollowSymbol] = useState("");
  const [interest, setInterest] = useState<CommunityInterest>("monitoring");
  const [watchlistName, setWatchlistName] = useState("");
  const [watchlistDescription, setWatchlistDescription] = useState("");
  const [watchlistSymbols, setWatchlistSymbols] = useState("");
  const [replaySymbol, setReplaySymbol] = useState("");
  const [replayTimestamp, setReplayTimestamp] = useState("");
  const [replayTitle, setReplayTitle] = useState("");
  const [replaySummary, setReplaySummary] = useState("");
  const [replayTags, setReplayTags] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const myFollowSymbols = useMemo(() => new Set(system.myFollows.map((item) => item.symbol)), [system.myFollows]);

  async function mutate(endpoint: string, body: Record<string, unknown>, method = "POST") {
    setPending(true);
    setStatus(null);
    try {
      const response = await csrfFetch(endpoint, {
        body: method === "DELETE" ? undefined : JSON.stringify(body),
        headers: method === "DELETE" ? undefined : { "Content-Type": "application/json" },
        method,
      });
      const payload = (await response.json().catch(() => null)) as CommunityApiResponse | null;
      if (!response.ok || !payload?.system) throw new Error(payload?.message ?? "Community update failed.");
      setSystem(payload.system);
      setStatus(payload.message ?? "Community intelligence updated.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Community update failed.");
    } finally {
      setPending(false);
    }
  }

  async function saveFollow() {
    if (!followSymbol.trim()) return;
    await mutate("/api/community/follows", { interest, symbol: followSymbol });
    setFollowSymbol("");
  }

  async function removeFollow(symbol: string) {
    await mutate(`/api/community/follows/${encodeURIComponent(symbol)}`, {}, "DELETE");
  }

  async function shareWatchlist() {
    if (!watchlistName.trim() || !watchlistSymbols.trim()) return;
    await mutate("/api/community/watchlists", {
      description: watchlistDescription,
      name: watchlistName,
      symbols: watchlistSymbols.split(/[,\s]+/).filter(Boolean),
    });
    setWatchlistName("");
    setWatchlistDescription("");
    setWatchlistSymbols("");
  }

  async function shareReplayStudy() {
    if (!replaySymbol.trim() || !replayTitle.trim() || !replaySummary.trim()) return;
    await mutate("/api/community/replay-studies", {
      replayTimestamp,
      summary: replaySummary,
      symbol: replaySymbol,
      tags: replayTags.split(/[,\s]+/).filter(Boolean),
      title: replayTitle,
    });
    setReplaySymbol("");
    setReplayTimestamp("");
    setReplayTitle("");
    setReplaySummary("");
    setReplayTags("");
  }

  return (
    <div className="space-y-5">
      <GlassPanel className="overflow-hidden border-cyan-300/15 bg-cyan-400/[0.02] p-5 sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-300">Community Intelligence</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">Shared Research, Not Social Noise</h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
              Opt-in shared watchlists, replay studies, and anonymous opportunity markers help surface what serious users are studying without turning TradeVeto into a hype feed.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <HeaderMetric label="Trends" value={String(system.mostFollowedOpportunities.length)} />
            <HeaderMetric label="Themes" value={String(system.topThemes.length)} />
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {system.metrics.map((metric) => <MetricCard key={metric.key} metric={metric} />)}
        </div>
      </GlassPanel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <GlassPanel className="p-5">
          <SectionTitle eyebrow="Community Briefing" title="What Serious Users Are Studying" meta="anonymous aggregate" />
          <div className="mt-4 grid gap-3">
            {system.educationalHighlights.map((line) => (
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300" key={line}>{line}</div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">Community attention is educational context. It does not override scanner evidence, macro pressure, fragility, or your own risk process.</p>
        </GlassPanel>

        <GlassPanel className="p-5">
          <SectionTitle eyebrow="Your Marker" title="Add Anonymous Context" meta={`${system.myFollows.length} saved`} />
          <div className="mt-4 grid gap-3">
            <input
              className="min-h-11 rounded-xl border border-white/10 bg-slate-950/65 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/45"
              disabled={pending}
              onChange={(event) => setFollowSymbol(event.target.value)}
              placeholder="AMD"
              value={followSymbol}
            />
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
              {INTEREST_OPTIONS.map((option) => (
                <button
                  className={`rounded-2xl border p-3 text-left transition ${interest === option.value ? "border-cyan-300/35 bg-cyan-400/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.055]"}`}
                  disabled={pending}
                  key={option.value}
                  onClick={() => setInterest(option.value)}
                  type="button"
                >
                  <div className="text-sm font-black text-slate-100">{option.label}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">{option.detail}</div>
                </button>
              ))}
            </div>
            <button className="min-h-11 rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/15 disabled:opacity-50" disabled={pending || !followSymbol.trim()} onClick={() => void saveFollow()} type="button">
              Save Marker
            </button>
            {system.myFollows.length ? (
              <div className="flex flex-wrap gap-2">
                {system.myFollows.map((follow) => (
                  <button className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs font-bold text-slate-300" disabled={pending} key={follow.symbol} onClick={() => void removeFollow(follow.symbol)} type="button">
                    {follow.symbol} · {follow.interest} ×
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {status ? <p className="mt-3 text-xs leading-5 text-slate-500">{status}</p> : null}
        </GlassPanel>
      </div>

      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Most Followed" title="Community Opportunity Trends" meta={`${system.mostFollowedOpportunities.length} ranked`} />
        <div className="mt-4 grid gap-3">
          {system.mostFollowedOpportunities.length ? system.mostFollowedOpportunities.map((item) => (
            <CommunityOpportunityCard followed={myFollowSymbols.has(item.symbol)} item={item} key={item.symbol} />
          )) : (
            <EmptyState text="No community opportunity trends yet. Add a marker or share a watchlist to start the aggregate." />
          )}
        </div>
      </GlassPanel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <GlassPanel className="p-5">
          <SectionTitle eyebrow="Themes" title="Top Community Themes" meta={`${system.topThemes.length} clusters`} />
          <div className="mt-4 grid gap-3">
            {system.topThemes.length ? system.topThemes.map((theme) => <ThemeCard item={theme} key={theme.theme} />) : <EmptyState text="Theme clusters appear after shared research accumulates." />}
          </div>
        </GlassPanel>

        <GlassPanel className="p-5">
          <SectionTitle eyebrow="Shared Watchlists" title="Educational Baskets" meta={`${system.sharedWatchlists.length} shared`} />
          <div className="mt-4 grid gap-3">
            {system.sharedWatchlists.length ? system.sharedWatchlists.slice(0, 8).map((watchlist) => <WatchlistCard item={watchlist} key={watchlist.id} />) : <EmptyState text="No shared watchlists yet." />}
          </div>
        </GlassPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <GlassPanel className="p-5">
          <SectionTitle eyebrow="Share" title="Publish a Watchlist" meta="opt-in only" />
          <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <input className="min-h-11 rounded-xl border border-white/10 bg-slate-950/65 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/45" disabled={pending} onChange={(event) => setWatchlistName(event.target.value)} placeholder="AI infrastructure basket" value={watchlistName} />
            <input className="min-h-11 rounded-xl border border-white/10 bg-slate-950/65 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/45" disabled={pending} onChange={(event) => setWatchlistSymbols(event.target.value)} placeholder="NVDA, AMD, MU" value={watchlistSymbols} />
            <textarea className="min-h-24 rounded-xl border border-white/10 bg-slate-950/65 p-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/45" disabled={pending} onChange={(event) => setWatchlistDescription(event.target.value)} placeholder="Why this basket is educational..." value={watchlistDescription} />
            <button className="min-h-11 rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/15 disabled:opacity-50" disabled={pending || !watchlistName.trim() || !watchlistSymbols.trim()} onClick={() => void shareWatchlist()} type="button">
              Share Watchlist
            </button>
          </div>
        </GlassPanel>

        <GlassPanel className="p-5">
          <SectionTitle eyebrow="Replay Studies" title="Shared Learning Examples" meta={`${system.replayStudies.length} studies`} />
          <div className="mt-4 grid gap-3">
            {system.replayStudies.length ? system.replayStudies.slice(0, 6).map((study) => <ReplayStudyCard item={study} key={study.id} />) : <EmptyState text="No replay studies yet." />}
          </div>
        </GlassPanel>
      </div>

      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Share Replay" title="Add an Educational Replay Study" meta="no advice claims" />
        <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
            <input className="min-h-11 rounded-xl border border-white/10 bg-slate-950/65 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/45" disabled={pending} onChange={(event) => setReplaySymbol(event.target.value)} placeholder="Symbol" value={replaySymbol} />
            <input className="min-h-11 rounded-xl border border-white/10 bg-slate-950/65 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/45" disabled={pending} onChange={(event) => setReplayTitle(event.target.value)} placeholder="Replay title" value={replayTitle} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="min-h-11 rounded-xl border border-white/10 bg-slate-950/65 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/45" disabled={pending} onChange={(event) => setReplayTimestamp(event.target.value)} placeholder="Replay timestamp optional" value={replayTimestamp} />
            <input className="min-h-11 rounded-xl border border-white/10 bg-slate-950/65 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/45" disabled={pending} onChange={(event) => setReplayTags(event.target.value)} placeholder="shock, pullback, macro" value={replayTags} />
          </div>
          <textarea className="min-h-28 rounded-xl border border-white/10 bg-slate-950/65 p-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/45" disabled={pending} onChange={(event) => setReplaySummary(event.target.value)} placeholder="What did the replay teach? Keep it evidence-based and non-advisory." value={replaySummary} />
          <div className="flex justify-end">
            <button className="min-h-11 rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/15 disabled:opacity-50" disabled={pending || !replaySymbol.trim() || !replayTitle.trim() || !replaySummary.trim()} onClick={() => void shareReplayStudy()} type="button">
              Share Replay Study
            </button>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Trust Boundary" title="Community Layer Limits" meta="controlled social" />
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {system.trustBoundaries.map((item) => (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-xs leading-5 text-slate-400" key={item}>{item}</div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}

function CommunityOpportunityCard({ followed, item }: { followed: boolean; item: CommunityOpportunityTrend }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link className="text-lg font-black text-slate-50 transition hover:text-cyan-200" href={`/symbol/${encodeURIComponent(item.symbol)}`}>{item.symbol}</Link>
            {item.companyName ? <span className="truncate text-sm text-slate-500">{item.companyName}</span> : null}
            {followed ? <span className="rounded-full border border-cyan-300/15 bg-cyan-400/[0.06] px-2.5 py-1 text-[11px] font-bold text-cyan-100">You marked this</span> : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{item.keyReason}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.tags.map((tag) => <Chip key={tag}>{tag}</Chip>)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
          <MiniScore label="Community" value={item.followCount + item.watchlistCount + item.replayStudyCount} />
          <MiniScore label="Opportunity" value={item.opportunityScore} />
          <MiniScore inverse label="Risk" value={item.riskScore} />
          <MiniScore label="Sentiment" value={item.sentimentScore} />
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-400/[0.04] p-3 text-xs leading-5 text-amber-100/80">{item.keyRisk}</div>
    </article>
  );
}

function ThemeCard({ item }: { item: CommunityThemeTrend }) {
  return (
    <div className={`rounded-2xl border p-4 ${toneClass(item.tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-slate-50">{item.theme}</div>
          <div className="mt-1 text-xs font-bold text-slate-500">{item.label}</div>
        </div>
        <div className="font-mono text-xl font-black text-slate-50">{item.score}</div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-400">{item.detail}</p>
    </div>
  );
}

function WatchlistCard({ item }: { item: CommunitySharedWatchlist }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-sm font-black text-slate-50">{item.name}</div>
      {item.description ? <p className="mt-2 text-xs leading-5 text-slate-500">{item.description}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {item.symbols.slice(0, 16).map((symbol) => (
          <Link className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-slate-300 transition hover:text-cyan-100" href={`/symbol/${encodeURIComponent(symbol)}`} key={symbol}>{symbol}</Link>
        ))}
      </div>
      <div className="mt-3 text-[11px] text-slate-600">{item.ownerLabel} · {shortDate(item.createdAt)}</div>
    </article>
  );
}

function ReplayStudyCard({ item }: { item: CommunityReplayStudy }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-black text-slate-50">{item.title}</h3>
        <Link className="text-xs font-bold text-cyan-200" href={`/history?symbol=${encodeURIComponent(item.symbol)}`}>{item.symbol}</Link>
      </div>
      <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-400">{item.summary}</p>
      <div className="mt-3 flex flex-wrap gap-2">{item.tags.map((tag) => <Chip key={tag}>{tag}</Chip>)}</div>
      <div className="mt-3 text-[11px] text-slate-600">{item.ownerLabel} · {shortDate(item.createdAt)}</div>
    </article>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="break-words text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500">{label}</div>
      <div className="mt-1 truncate font-mono text-lg font-black text-slate-50">{value}</div>
    </div>
  );
}

function MetricCard({ metric }: { metric: CommunityMetric }) {
  return (
    <div className={`min-w-0 rounded-2xl border p-4 ${toneClass(metric.tone)}`}>
      <div className="text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500">{metric.label}</div>
      <div className="mt-2 font-mono text-2xl font-black text-slate-50">{metric.value}</div>
      <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{metric.detail}</p>
    </div>
  );
}

function MiniScore({ inverse = false, label, value }: { inverse?: boolean; label: string; value: number }) {
  const constructive = inverse ? value <= 45 : value >= 62;
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/45 p-3">
      <div className="break-words text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-lg font-black ${constructive ? "text-emerald-200" : "text-slate-50"}`}>{value}</div>
    </div>
  );
}

function Chip({ children }: { children: string }) {
  return <span className="rounded-full border border-cyan-300/15 bg-cyan-400/[0.06] px-2.5 py-1 text-[11px] font-bold text-cyan-100">{children}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">{text}</p>;
}

function toneClass(tone: "constructive" | "neutral" | "risk"): string {
  if (tone === "constructive") return "border-emerald-300/15 bg-emerald-400/[0.035]";
  if (tone === "risk") return "border-amber-300/15 bg-amber-400/[0.035]";
  return "border-white/10 bg-white/[0.035]";
}

function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
