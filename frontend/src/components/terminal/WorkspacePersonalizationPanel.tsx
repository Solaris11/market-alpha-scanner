"use client";

import Link from "next/link";
import { Bell, ChevronDown, ChevronUp, EyeOff, LayoutDashboard, Smartphone, Star, StarOff } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useWorkspacePreferences } from "@/hooks/useWorkspacePreferences";
import {
  moduleLabel,
  WORKSPACE_MODE_LABELS,
  WORKSPACE_MODES,
  WORKSPACE_MODULES,
  WORKSPACE_RISK_STYLES,
  WORKSPACE_TIMEFRAMES,
  type WorkspaceMode,
  type WorkspaceModuleId,
  type WorkspacePreferences,
  type WorkspaceRiskStyle,
  type WorkspaceTimeframe,
} from "@/lib/trading/workspace-preferences";
import { humanizeInsightText } from "@/lib/ui/labels";
import { GlassPanel } from "./ui/GlassPanel";

export function WorkspacePersonalizationPanel({
  initialPreferences,
  recentSymbols,
  watchlistSymbols,
}: {
  initialPreferences?: WorkspacePreferences | null;
  recentSymbols: string[];
  watchlistSymbols: string[];
}) {
  const { actions, hydrated, preferences } = useWorkspacePreferences(initialPreferences);
  const [symbolInput, setSymbolInput] = useState("");
  const focusSymbols = useMemo(() => uniqueSymbols([...preferences.favoriteSymbols, ...watchlistSymbols, ...recentSymbols]).slice(0, 8), [preferences.favoriteSymbols, recentSymbols, watchlistSymbols]);
  const visibleModuleCount = WORKSPACE_MODULES.length - preferences.hiddenModules.length;

  function addSymbol() {
    if (!symbolInput.trim()) return;
    actions.toggleFavoriteSymbol(symbolInput);
    setSymbolInput("");
  }

  return (
    <GlassPanel className="poster-scanline overflow-hidden border-cyan-300/16 bg-cyan-400/[0.025] p-4 sm:p-5" data-onboarding-target="workspace-personalization">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
            <LayoutDashboard className="h-4 w-4" />
            Personal Workspace
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Make the terminal adapt to you</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {humanizeInsightText("TradeVeto prioritizes the modules, symbols, timeframes, and risk style you care about. Preferences are private to your account and local device.")}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[420px]">
          <StatusTile label="Mode" value={WORKSPACE_MODE_LABELS[preferences.workspaceMode]} />
          <StatusTile label="Visible modules" value={`${visibleModuleCount}/${WORKSPACE_MODULES.length}`} />
          <StatusTile label="Mobile starts at" value={moduleLabel(preferences.mobilePreferredOverview)} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Workspace mode</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {WORKSPACE_MODES.map((mode) => (
              <ModeButton active={preferences.workspaceMode === mode} key={mode} mode={mode} onClick={() => actions.setWorkspaceMode(mode)} />
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <ToggleSummary
              active={preferences.watchlistFirstMode}
              icon={<Star className="h-4 w-4" />}
              label="Watchlist-first"
              summary="Tracked symbols and alert changes move higher in the terminal."
            />
            <ToggleSummary
              active={preferences.macroFirstMode}
              icon={<Bell className="h-4 w-4" />}
              label="Macro-first"
              summary="Market state, macro pressure, and risk context move higher."
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Favorite symbols</div>
            <div className="text-[11px] text-slate-500">{preferences.favoriteSymbols.length}/16 saved</div>
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className="min-h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/45"
              onChange={(event) => setSymbolInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addSymbol();
              }}
              placeholder="Add ticker"
              value={symbolInput}
            />
            <button className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 text-sm font-black text-cyan-100 transition hover:border-cyan-200/60 hover:bg-cyan-300/15" onClick={addSymbol} type="button">
              Add
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {focusSymbols.length ? focusSymbols.map((symbol) => {
              const saved = preferences.favoriteSymbols.includes(symbol);
              return (
                <button
                  className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 font-mono text-xs font-black transition ${saved ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100" : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/35"}`}
                  key={symbol}
                  onClick={() => actions.toggleFavoriteSymbol(symbol)}
                  type="button"
                >
                  {saved ? <Star className="h-3.5 w-3.5" /> : <StarOff className="h-3.5 w-3.5" />}
                  {symbol}
                </button>
              );
            }) : (
              <p className="text-xs leading-5 text-slate-500">Add favorite symbols or build a watchlist to personalize this area.</p>
            )}
          </div>
        </div>
      </div>

      <details className="mt-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-100">
          <span>Customize modules, mobile cards, timeframes, and risk style</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{hydrated ? "saved" : "loading"}</span>
        </summary>
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Module order</div>
            <div className="mt-3 grid gap-2">
              {preferences.moduleOrder.map((moduleId, index) => (
                <ModulePreferenceRow
                  hidden={preferences.hiddenModules.includes(moduleId)}
                  index={index}
                  key={moduleId}
                  moduleId={moduleId}
                  onMoveDown={() => actions.moveModule(moduleId, "down")}
                  onMoveUp={() => actions.moveModule(moduleId, "up")}
                  onToggleFavorite={() => actions.toggleFavoriteModule(moduleId)}
                  onToggleHidden={() => actions.toggleModuleVisibility(moduleId)}
                  pinned={preferences.pinnedMobileCards.includes(moduleId)}
                  starred={preferences.favoriteModules.includes(moduleId)}
                  togglePinned={() => actions.togglePinnedMobileCard(moduleId)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <ControlGroup label="Preferred timeframes">
              {WORKSPACE_TIMEFRAMES.map((timeframe) => (
                <Chip
                  active={preferences.preferredTimeframes.includes(timeframe)}
                  key={timeframe}
                  onClick={() => actions.setPreferredTimeframes(toggleChip(preferences.preferredTimeframes, timeframe, 4))}
                >
                  {timeframe}
                </Chip>
              ))}
            </ControlGroup>
            <ControlGroup label="Risk style">
              {WORKSPACE_RISK_STYLES.map((style) => (
                <Chip
                  active={preferences.preferredRiskStyle === style}
                  key={style}
                  onClick={() => actions.setPreferredRiskStyle(style)}
                >
                  {riskStyleLabel(style)}
                </Chip>
              ))}
            </ControlGroup>
            <ControlGroup label="Mobile overview">
              {preferences.moduleOrder.slice(0, 6).map((moduleId) => (
                <Chip
                  active={preferences.mobilePreferredOverview === moduleId}
                  key={moduleId}
                  onClick={() => actions.setMobilePreferredOverview(moduleId)}
                >
                  {moduleLabel(moduleId)}
                </Chip>
              ))}
            </ControlGroup>
            <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.045] p-3">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
                <Smartphone className="h-4 w-4" />
                Mobile memory
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Last viewed symbol {preferences.mobileLastViewedSymbol ? (
                  <Link className="font-mono font-black text-cyan-100 underline decoration-cyan-300/40 underline-offset-4" href={`/symbol/${preferences.mobileLastViewedSymbol}`}>{preferences.mobileLastViewedSymbol}</Link>
                ) : "will appear after you open a symbol page"}.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Privacy</div>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                TradeVeto stores symbols, layout preferences, risk style, and quick-access choices. It does not store brokerage credentials or collect extra trading account data for personalization.
              </p>
            </div>
          </div>
        </div>
      </details>
    </GlassPanel>
  );
}

function ModeButton({ active, mode, onClick }: { active: boolean; mode: WorkspaceMode; onClick: () => void }) {
  return (
    <button
      className={`min-h-10 rounded-full border px-3 text-xs font-black transition ${active ? "border-cyan-200/60 bg-cyan-300/15 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.12)]" : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/35 hover:text-slate-100"}`}
      onClick={onClick}
      type="button"
    >
      {WORKSPACE_MODE_LABELS[mode]}
    </button>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-black text-slate-100" title={value}>{value}</div>
    </div>
  );
}

function ToggleSummary({ active, icon, label, summary }: { active: boolean; icon: ReactNode; label: string; summary: string }) {
  return (
    <div className={`rounded-2xl border p-3 ${active ? "border-emerald-300/25 bg-emerald-300/[0.045]" : "border-white/10 bg-white/[0.025]"}`}>
      <div className="flex items-center gap-2 text-sm font-black text-slate-100">
        <span className={active ? "text-emerald-200" : "text-slate-500"}>{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{summary}</p>
    </div>
  );
}

function ModulePreferenceRow({
  hidden,
  index,
  moduleId,
  onMoveDown,
  onMoveUp,
  onToggleFavorite,
  onToggleHidden,
  pinned,
  starred,
  togglePinned,
}: {
  hidden: boolean;
  index: number;
  moduleId: WorkspaceModuleId;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onToggleFavorite: () => void;
  onToggleHidden: () => void;
  pinned: boolean;
  starred: boolean;
  togglePinned: () => void;
}) {
  return (
    <div className={`grid gap-2 rounded-xl border p-2 sm:grid-cols-[36px_minmax(0,1fr)_auto] sm:items-center ${hidden ? "border-rose-300/20 bg-rose-300/[0.035]" : "border-white/10 bg-white/[0.035]"}`}>
      <div className="hidden h-8 w-8 place-items-center rounded-full border border-white/10 bg-slate-950/40 font-mono text-xs font-black text-slate-500 sm:grid">{index + 1}</div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-semibold text-slate-100">{moduleLabel(moduleId)}</div>
          {starred ? <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100">favorite</span> : null}
          {pinned ? <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100">mobile</span> : null}
          {hidden ? <span className="rounded-full border border-rose-300/20 bg-rose-300/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-rose-100">hidden</span> : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <IconButton label="Move up" onClick={onMoveUp}><ChevronUp className="h-4 w-4" /></IconButton>
        <IconButton label="Move down" onClick={onMoveDown}><ChevronDown className="h-4 w-4" /></IconButton>
        <IconButton label={starred ? "Remove favorite" : "Favorite"} onClick={onToggleFavorite}>{starred ? <Star className="h-4 w-4" /> : <StarOff className="h-4 w-4" />}</IconButton>
        <IconButton label={pinned ? "Unpin mobile" : "Pin mobile"} onClick={togglePinned}><Smartphone className="h-4 w-4" /></IconButton>
        <IconButton label={hidden ? "Show module" : "Hide module"} onClick={onToggleHidden}><EyeOff className="h-4 w-4" /></IconButton>
      </div>
    </div>
  );
}

function IconButton({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-slate-950/45 text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-100"
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function ControlGroup({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      className={`min-h-9 rounded-full border px-3 text-xs font-black transition ${active ? "border-cyan-200/50 bg-cyan-300/12 text-cyan-50" : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/35"}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function toggleChip<T extends string>(items: T[], item: T, limit: number): T[] {
  if (items.includes(item)) {
    const next = items.filter((value) => value !== item);
    return next.length ? next : [item];
  }
  return [...items, item].slice(-limit);
}

function riskStyleLabel(style: WorkspaceRiskStyle): string {
  if (style === "conservative") return "Conservative";
  if (style === "aggressive") return "Aggressive";
  return "Balanced";
}

function uniqueSymbols(symbols: string[]): string[] {
  return Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)));
}
