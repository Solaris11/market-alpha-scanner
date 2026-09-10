/**
 * Decision counts for the terminal command bar.
 *
 * Deliberately separate from `buildDecisionDistribution` in
 * TerminalPremiumView, which counts only WATCH / WAIT_PULLBACK / AVOID and
 * therefore cannot say whether an ENTER exists -- the first question a trader
 * opens the page to ask.
 *
 * Extending that helper instead would have been the obvious move and the wrong
 * one: `DailyActionCard` renders the distribution as percentages of its own
 * total, so a fourth category would silently change three numbers already on
 * screen. Counting here adds information without altering a displayed value.
 *
 * This reads decisions the scanner already made. It does not derive, re-score
 * or reinterpret any of them.
 */
export type TerminalDecisionCounts = {
  enter: number;
  watch: number;
  waitPullback: number;
  avoid: number;
  exit: number;
  total: number;
};

export function countTerminalDecisions(rows: Array<{ final_decision?: unknown }> | null | undefined): TerminalDecisionCounts {
  const counts: TerminalDecisionCounts = { enter: 0, watch: 0, waitPullback: 0, avoid: 0, exit: 0, total: 0 };
  if (!Array.isArray(rows)) return counts;
  for (const row of rows) {
    counts.total += 1;
    // Normalise the way the rest of the codebase does: trim, upper-case, and
    // treat the hyphenated spelling as the underscore one. A decision that
    // arrives as "wait-pullback" is the same decision.
    const decision = String(row?.final_decision ?? "").trim().toUpperCase().replace(/-/g, "_");
    switch (decision) {
      case "ENTER":
        counts.enter += 1;
        break;
      case "WATCH":
        counts.watch += 1;
        break;
      case "WAIT_PULLBACK":
        counts.waitPullback += 1;
        break;
      case "AVOID":
        counts.avoid += 1;
        break;
      case "EXIT":
        counts.exit += 1;
        break;
      default:
        break;
    }
  }
  return counts;
}
