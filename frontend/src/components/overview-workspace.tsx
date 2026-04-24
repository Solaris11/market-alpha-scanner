"use client";

import { useMemo, useState } from "react";
import { RankingTable } from "@/components/ranking-table";
import type { RankingRow } from "@/lib/types";

type Props = {
  ranking: RankingRow[];
  topCandidates: RankingRow[];
};

function uniqueOptions(rows: RankingRow[], key: keyof RankingRow) {
  return Array.from(new Set(rows.map((row) => String(row[key] ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function matchesText(value: unknown, query: string) {
  return String(value ?? "")
    .toLowerCase()
    .includes(query);
}

export function OverviewWorkspace({ ranking, topCandidates }: Props) {
  const [symbolSearch, setSymbolSearch] = useState("");
  const [assetType, setAssetType] = useState("");
  const [sector, setSector] = useState("");
  const [rating, setRating] = useState("");
  const [minimumScore, setMinimumScore] = useState("");

  const assetTypes = useMemo(() => uniqueOptions(ranking, "asset_type"), [ranking]);
  const sectors = useMemo(() => {
    const source = assetType ? ranking.filter((row) => String(row.asset_type ?? "") === assetType) : ranking;
    return uniqueOptions(source, "sector");
  }, [assetType, ranking]);
  const ratings = useMemo(() => uniqueOptions(ranking, "rating"), [ranking]);

  const filteredRows = useMemo(() => {
    const query = symbolSearch.trim().toLowerCase();
    const minScore = Number(minimumScore);
    const hasMinScore = minimumScore.trim() !== "" && Number.isFinite(minScore);

    return ranking.filter((row) => {
      if (query) {
        if (!matchesText(row.symbol, query) && !matchesText(row.company_name, query)) return false;
      }
      if (assetType && String(row.asset_type ?? "") !== assetType) return false;
      if (sector && String(row.sector ?? "") !== sector) return false;
      if (rating && String(row.rating ?? "") !== rating) return false;
      if (hasMinScore && (typeof row.final_score !== "number" || row.final_score < minScore)) return false;
      return true;
    });
  }, [assetType, minimumScore, ranking, rating, sector, symbolSearch]);
  const filteredTopCandidates = useMemo(() => {
    const visibleSymbols = new Set(filteredRows.map((row) => row.symbol));
    return topCandidates.filter((row) => visibleSymbols.has(row.symbol));
  }, [filteredRows, topCandidates]);

  function resetFilters() {
    setSymbolSearch("");
    setAssetType("");
    setSector("");
    setRating("");
    setMinimumScore("");
  }

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_520px]">
      <section className="min-w-0">
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Full Ranking</div>
            <h2 className="text-lg font-semibold text-slate-50">Scanner Table</h2>
          </div>
          <div className="whitespace-nowrap text-xs text-slate-500">
            {filteredRows.length.toLocaleString()} of {ranking.length.toLocaleString()} rows
          </div>
        </div>

        <div className="terminal-panel mb-3 rounded-md p-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_0.85fr_0.75fr_auto]">
            <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Symbol
              <input
                className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
                onChange={(event) => setSymbolSearch(event.target.value)}
                placeholder="Search symbol or company"
                value={symbolSearch}
              />
            </label>

            <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Asset Type
              <select
                className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
                onChange={(event) => {
                  setAssetType(event.target.value);
                  setSector("");
                }}
                value={assetType}
              >
                <option value="">All asset types</option>
                {assetTypes.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Sector
              <select
                className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
                onChange={(event) => setSector(event.target.value)}
                value={sector}
              >
                <option value="">All sectors</option>
                {sectors.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Rating
              <select
                className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
                onChange={(event) => setRating(event.target.value)}
                value={rating}
              >
                <option value="">All ratings</option>
                {ratings.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Min Score
              <input
                className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
                min="0"
                onChange={(event) => setMinimumScore(event.target.value)}
                placeholder="0"
                type="number"
                value={minimumScore}
              />
            </label>

            <button
              className="self-end rounded border border-slate-700/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-sky-400/50 hover:text-sky-200"
              onClick={resetFilters}
              type="button"
            >
              Reset
            </button>
          </div>
        </div>

        <RankingTable rows={filteredRows} emptyMessage="No matching symbols" />
      </section>

      <aside className="space-y-3">
        <section>
          <div className="mb-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Top Candidates</div>
            <h2 className="text-lg font-semibold text-slate-50">High Conviction</h2>
          </div>
          <RankingTable rows={filteredTopCandidates} highlight limit={10} emptyMessage="No matching symbols" />
        </section>

        <section className="terminal-panel rounded-md p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Watchlist</div>
          <div className="mt-2 divide-y divide-slate-800 text-xs text-slate-400">
            {["Add symbols from detail pages", "Local persistence to be wired next"].map((item) => (
              <div className="py-2" key={item}>
                {item}
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
