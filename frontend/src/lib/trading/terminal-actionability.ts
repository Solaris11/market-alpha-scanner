import { buildOpportunityActionability } from "./opportunity-actionability";
import type { OpportunityViewModel } from "./opportunity-view-model";

/**
 * The five actionability strings the terminal renders, computed on the server.
 *
 * buildOpportunityActionability reads row.shockPattern.shockEvents -- every
 * event's preconditions, excursions and returns -- to calibrate the execution
 * state that these five strings are derived from. That array is 4.7 MB of the
 * /terminal payload, and it exists in the payload only because two client
 * components call this function.
 *
 * So the terminal computes the cards once on the server, from unstripped rows,
 * and passes them down. Once every consumer reads the card instead of the row,
 * the array can leave the payload without any rendered value changing.
 *
 * Sixteen fields come back from buildOpportunityActionability; five are
 * rendered. Only those five travel.
 */
export type TerminalActionabilityCard = {
  actionContext: string;
  earlyOrLate: string;
  invalidationExplanation: string;
  primaryActionLabel: string;
  whatToWaitFor: string;
};

/** Keyed by uppercased symbol. */
export type TerminalActionabilityMap = Record<string, TerminalActionabilityCard>;

export function actionabilityCardFromRow(row: OpportunityViewModel): TerminalActionabilityCard {
  const actionability = buildOpportunityActionability(row);
  return {
    actionContext: actionability.actionContext,
    earlyOrLate: actionability.earlyOrLate,
    invalidationExplanation: actionability.invalidationExplanation,
    primaryActionLabel: actionability.primaryActionLabel,
    whatToWaitFor: actionability.whatToWaitFor,
  };
}

/**
 * Every row, not the visible subset.
 *
 * ShockMoveRadar sorts and slices client-side, and RiskTolerantOpportunityRadar
 * re-derives its candidates whenever the reader changes risk profile. The server
 * cannot know which symbols will surface, so it cannot send fewer.
 */
export function buildTerminalActionabilityMap(rows: OpportunityViewModel[]): TerminalActionabilityMap {
  const map: TerminalActionabilityMap = {};
  for (const row of rows) {
    const symbol = String(row.symbol ?? "").trim().toUpperCase();
    if (!symbol || map[symbol]) continue;
    map[symbol] = actionabilityCardFromRow(row);
  }
  return map;
}

/**
 * Look the card up, or compute it.
 *
 * The fallback is what lets these components keep working on /opportunities,
 * which renders them with unstripped rows and no map. It is deliberately a
 * fallback rather than a hard requirement -- but it is also why the map has to
 * cover every row: once the array is stripped, a missing key would compute a
 * degraded card rather than throwing. The coverage test is what guards that.
 */
export function actionabilityCardFor(row: OpportunityViewModel, map?: TerminalActionabilityMap): TerminalActionabilityCard {
  const symbol = String(row.symbol ?? "").trim().toUpperCase();
  return map?.[symbol] ?? actionabilityCardFromRow(row);
}
