import type { RankingRow } from "@/lib/types";

/**
 * Bucket the scanner's own decisions into the three answers a trader needs on
 * the first screen, and pick the few names worth naming there.
 *
 * This is a SUMMARY, not a fifth opportunity list. /terminal already answers
 * "what are the best setups" in four places (DailyMarketCommandCenter's Top 5,
 * UnifiedIntelligenceConsole's Best Opportunities, BestTradeNowCard and the
 * Research Queue). Adding another ranked list would make the duplication
 * problem worse, so this names a handful and links to the symbol pages; the
 * full lists stay exactly where they are.
 *
 * It re-derives nothing. `final_decision` is the scanner's verdict and is used
 * as given; ordering is by the score the scanner already assigned. No
 * threshold, no re-scoring, no reinterpretation.
 */
export type TriageBucket = "ENTER" | "WATCH" | "WAIT_PULLBACK" | "AVOID" | "EXIT" | "OTHER";

export type TriageEntry = {
  symbol: string;
  score: number | null;
  riskReward: number | null;
  reason: string;
};

export type ActionTriage = {
  counts: Record<TriageBucket, number>;
  enter: TriageEntry[];
  watch: TriageEntry[];
  waitPullback: TriageEntry[];
};

export function normalizeDecision(value: unknown): TriageBucket {
  const decision = String(value ?? "").trim().toUpperCase().replace(/-/g, "_");
  switch (decision) {
    case "ENTER":
    case "WATCH":
    case "WAIT_PULLBACK":
    case "AVOID":
    case "EXIT":
      return decision;
    default:
      return "OTHER";
  }
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toEntry(row: RankingRow): TriageEntry {
  const reason = String(
    (row as { decision_reason?: unknown }).decision_reason ?? (row as { selection_reason?: unknown }).selection_reason ?? "",
  ).trim();
  return {
    symbol: String(row.symbol ?? "").trim().toUpperCase(),
    score: finiteOrNull(row.final_score),
    riskReward: finiteOrNull(row.risk_reward),
    reason,
  };
}

export function buildActionTriage(rows: readonly RankingRow[] | null | undefined, perBucket = 3): ActionTriage {
  const counts: Record<TriageBucket, number> = { ENTER: 0, WATCH: 0, WAIT_PULLBACK: 0, AVOID: 0, EXIT: 0, OTHER: 0 };
  const grouped: Record<"ENTER" | "WATCH" | "WAIT_PULLBACK", RankingRow[]> = { ENTER: [], WATCH: [], WAIT_PULLBACK: [] };

  for (const row of Array.isArray(rows) ? rows : []) {
    const bucket = normalizeDecision(row?.final_decision);
    counts[bucket] += 1;
    if (bucket === "ENTER" || bucket === "WATCH" || bucket === "WAIT_PULLBACK") {
      if (String(row?.symbol ?? "").trim()) grouped[bucket].push(row);
    }
  }

  // Highest score first. A row with no score sorts last rather than being
  // treated as zero -- "unscored" and "scored zero" are different states and
  // collapsing them would quietly promote broken rows above real ones.
  const byScore = (a: RankingRow, b: RankingRow) => {
    const left = finiteOrNull(a.final_score);
    const right = finiteOrNull(b.final_score);
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return right - left;
  };

  const top = (bucket: "ENTER" | "WATCH" | "WAIT_PULLBACK") =>
    [...grouped[bucket]].sort(byScore).slice(0, Math.max(0, perBucket)).map(toEntry);

  return {
    counts,
    enter: top("ENTER"),
    watch: top("WATCH"),
    waitPullback: top("WAIT_PULLBACK"),
  };
}
