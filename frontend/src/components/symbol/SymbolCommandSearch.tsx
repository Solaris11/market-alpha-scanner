"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Clock3, Filter, Save, Search } from "lucide-react";
import {
  buildSymbolSearchFacets,
  defaultSymbolSearchFilters,
  searchSymbolIndex,
  type SymbolSearchDocument,
  type SymbolSearchFilterState,
  type SymbolSearchSort,
} from "@/lib/trading/symbol-workflow-maturity";

type Props = {
  documents: SymbolSearchDocument[];
  initialQuery?: string;
  title?: string;
};

const RECENT_KEY = "tradeveto.symbolSearch.recent";
const HISTORY_KEY = "tradeveto.symbolSearch.history";
const FILTER_KEY = "tradeveto.symbolSearch.filters";
const SORTS: Array<{ label: string; value: SymbolSearchSort }> = [
  { label: "Relevance", value: "relevance" },
  { label: "Score", value: "score" },
  { label: "Risk", value: "risk" },
  { label: "History", value: "history" },
  { label: "Symbol", value: "symbol" },
];

export function SymbolCommandSearch({ documents, initialQuery = "", title = "Symbol command search" }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [activeIndex, setActiveIndex] = useState(0);
  const [filters, setFilters] = useState<SymbolSearchFilterState>(() => defaultSymbolSearchFilters());
  const [recentSymbols, setRecentSymbols] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const facets = useMemo(() => buildSymbolSearchFacets(documents), [documents]);
  const response = useMemo(() => searchSymbolIndex(documents, query, filters, 10), [documents, filters, query]);
  const results = response.results;

  useEffect(() => {
    setRecentSymbols(readStringArray(RECENT_KEY));
    setSearchHistory(readStringArray(HISTORY_KEY));
    const saved = readSavedFilters();
    if (saved) setFilters(saved);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      if (event.key === "/" || (event.altKey && event.key.toLowerCase() === "s") || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, filters]);

  function remember(symbol: string): void {
    const nextRecent = pushUnique(symbol, recentSymbols).slice(0, 8);
    setRecentSymbols(nextRecent);
    writeStringArray(RECENT_KEY, nextRecent);
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      const nextHistory = pushUnique(trimmedQuery, searchHistory).slice(0, 8);
      setSearchHistory(nextHistory);
      writeStringArray(HISTORY_KEY, nextHistory);
    }
  }

  function openActive(): void {
    const active = results[activeIndex] ?? results[0];
    if (!active) return;
    remember(active.document.symbol);
    window.location.assign(`/symbol/${encodeURIComponent(active.document.symbol)}`);
  }

  function updateFilter<K extends keyof SymbolSearchFilterState>(key: K, value: SymbolSearchFilterState[K]): void {
    setFilters((current) => defaultSymbolSearchFilters({ ...current, [key]: value }));
  }

  function saveFilters(): void {
    window.localStorage.setItem(FILTER_KEY, JSON.stringify(filters));
  }

  function clearFilters(): void {
    const next = defaultSymbolSearchFilters();
    setFilters(next);
    window.localStorage.removeItem(FILTER_KEY);
  }

  return (
    <section
      className="terminal-panel rounded-2xl p-4"
      aria-labelledby="symbol-command-search-heading"
      data-symbol-command-search="true"
      data-symbol-search-index-size={documents.length}
      data-symbol-search-result-count={results.length}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Instant symbol workflow</div>
          <h2 id="symbol-command-search-heading" className="mt-1 text-lg font-semibold text-slate-50">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Search ticker, company, sector, setup, macro regime, replay memory, and scanner context. Ranking is deterministic from TradeVeto evidence, not fabricated provider intelligence.
          </p>
        </div>
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15"
          onClick={() => inputRef.current?.focus()}
          type="button"
        >
          <Search className="h-4 w-4" />
          Cmd+K / Alt+S
        </button>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <label className="block">
            <span className="sr-only">Search symbols</span>
            <div className="flex min-h-12 items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-3 focus-within:border-cyan-300/45">
              <Search className="h-4 w-4 shrink-0 text-cyan-200" />
              <input
                ref={inputRef}
                className="min-w-0 flex-1 bg-transparent py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600"
                data-symbol-search-input="true"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveIndex((index) => Math.min(results.length - 1, index + 1));
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveIndex((index) => Math.max(0, index - 1));
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    openActive();
                  }
                  if (event.key === "Escape") {
                    setQuery("");
                  }
                }}
                placeholder="Search AMD, semiconductors, risk-on, breakout, replay..."
                type="search"
                value={query}
              />
              <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-slate-500 sm:inline">Enter</span>
            </div>
          </label>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
            <SelectFilter label="Sector" onChange={(value) => updateFilter("sectors", value ? [value] : [])} options={facets.sectors} value={filters.sectors[0] ?? ""} />
            <SelectFilter label="Setup" onChange={(value) => updateFilter("setups", value ? [value] : [])} options={facets.setups} value={filters.setups[0] ?? ""} />
            <SelectFilter label="Macro" onChange={(value) => updateFilter("macroRegimes", value ? [value] : [])} options={facets.macroRegimes} value={filters.macroRegimes[0] ?? ""} />
            <SelectFilter label="Source" onChange={(value) => updateFilter("sourceTags", value ? [value] : [])} options={facets.sourceTags} value={filters.sourceTags[0] ?? ""} />
            <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Min score
              <select className="mt-1 h-9 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 text-xs normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-300/50" onChange={(event) => updateFilter("minScore", event.target.value ? Number(event.target.value) : null)} value={filters.minScore ?? ""}>
                <option value="">Any</option>
                <option value="50">50+</option>
                <option value="60">60+</option>
                <option value="70">70+</option>
                <option value="80">80+</option>
              </select>
            </label>
            <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Max risk
              <select className="mt-1 h-9 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 text-xs normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-300/50" onChange={(event) => updateFilter("maxRisk", event.target.value ? Number(event.target.value) : null)} value={filters.maxRisk ?? ""}>
                <option value="">Any</option>
                <option value="80">80 or less</option>
                <option value="70">70 or less</option>
                <option value="60">60 or less</option>
                <option value="50">50 or less</option>
              </select>
            </label>
            <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Sort
              <select className="mt-1 h-9 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 text-xs normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-300/50" onChange={(event) => updateFilter("sort", event.target.value as SymbolSearchSort)} value={filters.sort}>
                {SORTS.map((sort) => <option key={sort.value} value={sort.value}>{sort.label}</option>)}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Toggle checked={filters.historyOnly} label="Replay/history only" onChange={(checked) => updateFilter("historyOnly", checked)} />
            <Toggle checked={filters.watchlistOnly} label="Watchlist only" onChange={(checked) => updateFilter("watchlistOnly", checked)} />
            <button className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 font-semibold text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-100" onClick={saveFilters} type="button">
              <Save className="h-3.5 w-3.5" />
              Save filters
            </button>
            <button className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 font-semibold text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-100" onClick={clearFilters} type="button">
              <Filter className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>

          <div className="grid gap-2" data-symbol-search-results="true" role="listbox">
            {results.length ? results.map((result, index) => (
              <Link
                aria-selected={activeIndex === index}
                className={`rounded-xl border p-3 transition ${activeIndex === index ? "border-cyan-300/45 bg-cyan-400/10" : "border-white/10 bg-white/[0.035] hover:border-cyan-300/30 hover:bg-white/[0.055]"}`}
                data-symbol-search-result="true"
                href={`/symbol/${encodeURIComponent(result.document.symbol)}`}
                key={result.document.symbol}
                onClick={() => remember(result.document.symbol)}
                role="option"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-black text-slate-50">{result.document.symbol}</span>
                      <span className="truncate text-sm font-semibold text-slate-300">{result.document.companyName || result.document.theme}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{result.matchReasons.join(", ") || "ranked by scanner relevance, history depth, and workflow context"}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-right font-mono text-xs">
                    <Mini label="Score" value={metric(result.document.score)} />
                    <Mini label="Risk" value={metric(result.document.riskScore)} />
                    <Mini label="History" value={result.document.historyCount.toLocaleString()} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                  {[result.document.sector, result.document.setupType, result.document.macroRegime, ...result.document.sourceTags].filter(Boolean).slice(0, 6).map((tag) => (
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1" key={`${result.document.symbol}:${tag}`}>{tag}</span>
                  ))}
                </div>
              </Link>
            )) : (
              <div className="rounded-xl border border-dashed border-slate-700/70 bg-slate-950/35 p-5 text-sm text-slate-400">No symbol matches the current search and filters.</div>
            )}
          </div>
        </div>

        <aside className="space-y-3">
          <Panel title="Workflow memory" icon={<Clock3 className="h-4 w-4" />}>
            <MemoryButtons items={recentSymbols} onSelect={setQuery} title="Recent symbols" />
            <MemoryButtons items={searchHistory} onSelect={setQuery} title="Search history" />
          </Panel>
          <Panel title="Quick routes" icon={<ArrowRight className="h-4 w-4" />}>
            {(results.slice(0, 4)).map((result) => (
              <div className="grid grid-cols-3 gap-2 text-xs" key={`routes:${result.document.symbol}`}>
                <Link className="rounded-lg border border-white/10 px-2 py-2 text-center text-slate-300 hover:border-cyan-300/35 hover:text-cyan-100" href={`/symbol/${encodeURIComponent(result.document.symbol)}`}>Symbol</Link>
                <Link className="rounded-lg border border-white/10 px-2 py-2 text-center text-slate-300 hover:border-cyan-300/35 hover:text-cyan-100" href={`/history?symbol=${encodeURIComponent(result.document.symbol)}`}>History</Link>
                <Link className="rounded-lg border border-white/10 px-2 py-2 text-center text-slate-300 hover:border-cyan-300/35 hover:text-cyan-100" href="/performance#history">Performance</Link>
              </div>
            ))}
          </Panel>
        </aside>
      </div>
    </section>
  );
}

function SelectFilter({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: string[]; value: string }) {
  return (
    <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
      {label}
      <select className="mt-1 h-9 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 text-xs normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-300/50" onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="">Any</option>
        {options.slice(0, 80).map((option) => <option key={option} value={option.toUpperCase()}>{option}</option>)}
      </select>
    </label>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 font-semibold text-slate-300">
      <input checked={checked} className="h-4 w-4 accent-cyan-300" onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      {label}
    </label>
  );
}

function Panel({ children, icon, title }: { children: React.ReactNode; icon: React.ReactNode; title: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">
        {icon}
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function MemoryButtons({ items, onSelect, title }: { items: string[]; onSelect: (value: string) => void; title: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {items.length ? items.map((item) => (
          <button className="rounded-full border border-white/10 px-2 py-1 font-mono text-[11px] text-slate-300 hover:border-cyan-300/35 hover:text-cyan-100" key={`${title}:${item}`} onClick={() => onSelect(item)} type="button">
            {item}
          </button>
        )) : <span className="text-xs text-slate-600">No local memory yet.</span>}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="text-slate-100">{value}</div>
    </div>
  );
}

function metric(value: number | null): string {
  return value === null ? "N/A" : Math.round(value).toString();
}

function readStringArray(key: string): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(value) ? value.map((item) => String(item).trim().toUpperCase()).filter(Boolean).slice(0, 8) : [];
  } catch {
    return [];
  }
}

function writeStringArray(key: string, value: string[]): void {
  window.localStorage.setItem(key, JSON.stringify(value.slice(0, 8)));
}

function readSavedFilters(): SymbolSearchFilterState | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FILTER_KEY) ?? "null") as Partial<SymbolSearchFilterState> | null;
    return parsed ? defaultSymbolSearchFilters(parsed) : null;
  } catch {
    return null;
  }
}

function pushUnique(value: string, current: string[]): string[] {
  const cleaned = value.trim().toUpperCase();
  if (!cleaned) return current;
  return [cleaned, ...current.filter((item) => item !== cleaned)];
}
