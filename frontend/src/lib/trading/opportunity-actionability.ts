import type { ExecutionIntelligence, ExecutionScore, ExecutionState, ExecutionTone } from "./execution-intelligence";
import { buildExecutionIntelligence } from "./execution-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";
import { cleanText, finiteNumber, formatNumber } from "@/lib/ui/formatters";
import { decisionLabel, humanizeInsightText } from "@/lib/ui/labels";

export type ActionabilityMetric = {
  label: string;
  score: number | null;
  tone: ExecutionTone;
  value: string;
};

export type OpportunityActionability = {
  actionContext: string;
  asymmetryClarity: string;
  chaseRiskVisibility: ActionabilityMetric;
  confirmationStatus: ActionabilityMetric;
  earlyOrLate: string;
  entryZoneClarity: string;
  historicalExitGuidance: string;
  invalidationExplanation: string;
  primaryActionLabel: string;
  pullbackGuidance: string;
  pullbackQuality: ActionabilityMetric;
  riskRewardCommunication: string;
  timingQuality: ActionabilityMetric;
  whatToWaitFor: string;
  whyInteresting: string;
  whyRisky: string;
};

export function buildOpportunityActionability(row: OpportunityViewModel): OpportunityActionability {
  const execution = buildExecutionIntelligence(row);
  const state = execution.executionState;
  const whyInteresting = whyInterestingFor(row, execution);
  const whatToWaitFor = whatToWaitForRow(row, execution);
  const invalidationExplanation = invalidationFor(row, execution);
  const whyRisky = whyRiskyFor(row, execution);

  return {
    actionContext: actionContextFor(execution, whatToWaitFor),
    asymmetryClarity: asymmetryFor(row),
    chaseRiskVisibility: chaseRiskMetric(execution.chaseRisk),
    confirmationStatus: confirmationMetric(execution.confirmationQuality),
    earlyOrLate: earlyOrLateFor(state),
    entryZoneClarity: entryZoneFor(execution),
    historicalExitGuidance: historicalExitFor(execution),
    invalidationExplanation,
    primaryActionLabel: primaryActionLabelFor(state),
    pullbackGuidance: pullbackGuidanceFor(execution),
    pullbackQuality: scoreMetric(execution.pullbackQuality),
    riskRewardCommunication: riskRewardFor(row, execution),
    timingQuality: timingMetric(execution.timingQualityScore),
    whatToWaitFor,
    whyInteresting,
    whyRisky,
  };
}

function actionContextFor(execution: ExecutionIntelligence, whatToWaitFor: string): string {
  if (execution.executionState === "avoid_chase") {
    return `This is stretched, so patience matters. ${whatToWaitFor}`;
  }
  if (execution.executionState === "extended_entry") {
    return `Entry quality is stretched, but the setup can improve with a calmer pullback. ${whatToWaitFor}`;
  }
  if (execution.executionState === "wait_for_pullback") {
    return `The setup is interesting, but the cleaner path is a pullback first. ${whatToWaitFor}`;
  }
  if (execution.executionState === "confirmation_needed") {
    return `This needs more confirmation before it becomes clean. ${whatToWaitFor}`;
  }
  if (execution.executionState === "breakout_confirmed") {
    return `Confirmation is present; entry quality is better if price stays out of the do-not-chase area (${execution.zones.doNotChaseZone}).`;
  }
  if (execution.executionState === "early_opportunity") {
    return `This is early enough to monitor closely near ${execution.zones.researchEntryZone}; confirmation still matters.`;
  }
  return `Trigger conditions are approaching. ${whatToWaitFor}`;
}

function whyInterestingFor(row: OpportunityViewModel, execution: ExecutionIntelligence): string {
  const shock = row.shockPattern;
  if (shock && shock.upsideShockScore >= 70) {
    return `${row.symbol} is interesting because historically similar setups produced strong upside moves, while current timing is ${execution.executionStateLabel.toLowerCase()}.`;
  }
  if ((row.final_score ?? 0) >= 72 || row.conviction >= 70) {
    return `${row.symbol} is interesting because setup quality is above the current universe baseline and the system still has explicit timing guardrails.`;
  }
  if (execution.pullbackQuality.score >= 68) {
    return `${row.symbol} is interesting mainly as a pullback watch; the setup becomes cleaner if price stabilizes near the research entry zone.`;
  }
  return `${row.symbol} has enough scanner context to monitor, but the evidence still needs cleaner confirmation.`;
}

function whatToWaitForRow(row: OpportunityViewModel, execution: ExecutionIntelligence): string {
  const confirm = execution.whatToConfirm[0] ? humanizeInsightText(execution.whatToConfirm[0]) : "";
  if (execution.executionState === "avoid_chase" || execution.executionState === "extended_entry") {
    return `Wait for a pullback toward the research entry area near ${execution.zones.researchEntryZone} instead of chasing the do-not-chase area (${execution.zones.doNotChaseZone}).`;
  }
  if (execution.executionState === "wait_for_pullback") {
    return `Wait for a pullback toward ${execution.zones.researchEntryZone} and signs that fragility is not rising.`;
  }
  if (execution.executionState === "breakout_confirmed") {
    return `Watch whether confirmation holds while price stays out of the do-not-chase area.`;
  }
  if (execution.executionState === "early_opportunity") {
    return `Watch for relative volume, market confirmation, and price staying near ${execution.zones.researchEntryZone}.`;
  }
  if (confirm) return confirm;
  return `${decisionLabel(row.final_decision)} still needs cleaner confirmation before the setup quality improves.`;
}

function whyRiskyFor(row: OpportunityViewModel, execution: ExecutionIntelligence): string {
  const risk = execution.keyRisks[0] ? humanizeInsightText(execution.keyRisks[0]) : "";
  if (risk) return risk;
  if (row.fragility >= 70) return "Fragility is elevated, so small timing mistakes can create larger downside risk.";
  if (row.eventRisk >= 68) return "Event pressure is elevated, so the setup may react sharply to fresh information.";
  return "Risk is still present because the setup depends on confirmation, entry discipline, and current market context.";
}

function invalidationFor(row: OpportunityViewModel, execution: ExecutionIntelligence): string {
  const risk = execution.keyRisks[0] ? ` ${humanizeInsightText(execution.keyRisks[0])}` : "";
  const label = cleanText(execution.zones.invalidationZone, "the invalidation area");
  return `The setup weakens if price loses ${label}.${risk}`;
}

function entryZoneFor(execution: ExecutionIntelligence): string {
  if (execution.executionState === "avoid_chase" || execution.executionState === "extended_entry") {
    return `Preferred research area is ${execution.zones.researchEntryZone}; ${execution.zones.doNotChaseZone} is where late-entry risk becomes more visible.`;
  }
  return `Research entry area is ${execution.zones.researchEntryZone}; treat it as context, not an order instruction.`;
}

function pullbackGuidanceFor(execution: ExecutionIntelligence): string {
  if (execution.pullbackQuality.score >= 68) {
    return `Pullback quality is favorable if price stabilizes near ${execution.zones.researchEntryZone}.`;
  }
  if (execution.executionState === "avoid_chase" || execution.executionState === "extended_entry") {
    return `A pullback is preferred because the current entry is stretched.`;
  }
  return `Pullback evidence is still developing; confirmation matters more than speed.`;
}

function historicalExitFor(execution: ExecutionIntelligence): string {
  return `Historical exit area: ${execution.zones.historicalExitZone}. Treat it as research context, not an exit instruction.`;
}

function asymmetryFor(row: OpportunityViewModel): string {
  const shock = row.shockPattern;
  if (shock) {
    return `Upside/downside balance is ${formatNumber(shock.asymmetryScore, 0)}/100: upside evidence is weighed against downside and late-entry risk.`;
  }
  const riskReward = finiteNumber(row.raw.risk_reward ?? row.raw.reward_risk_ratio ?? row.raw.conservative_risk_reward);
  if (riskReward !== null) {
    return `Reward/risk context is about ${formatNumber(riskReward, 1)}x, but upside/downside evidence is still limited without deeper large-move history.`;
  }
  return "Upside/downside evidence is limited; use entry timing, the break area, and fragility first.";
}

function riskRewardFor(row: OpportunityViewModel, execution: ExecutionIntelligence): string {
  const riskReward = finiteNumber(row.raw.risk_reward ?? row.raw.reward_risk_ratio ?? row.raw.conservative_risk_reward);
  if (riskReward !== null) {
    return `Reward/risk is about ${formatNumber(riskReward, 1)}x in the current research model; the downside reference is ${execution.zones.invalidationZone}.`;
  }
  return `Reward/risk evidence is still building; use ${execution.zones.invalidationZone} as the downside reference.`;
}

function primaryActionLabelFor(state: ExecutionState): string {
  const labels: Record<ExecutionState, string> = {
    avoid_chase: "Avoid chase",
    breakout_confirmed: "Good setup",
    confirmation_needed: "Watch only",
    early_opportunity: "Watch only",
    extended_entry: "Wait for pullback",
    trigger_approaching: "Watch only",
    wait_for_pullback: "Wait for pullback",
  };
  return labels[state];
}

function earlyOrLateFor(state: ExecutionState): string {
  const labels: Record<ExecutionState, string> = {
    avoid_chase: "Extended",
    breakout_confirmed: "Confirmed",
    confirmation_needed: "Early; needs confirmation",
    early_opportunity: "Early",
    extended_entry: "Extended",
    trigger_approaching: "Approaching",
    wait_for_pullback: "Pullback needed",
  };
  return labels[state];
}

function confirmationMetric(score: ExecutionScore): ActionabilityMetric {
  const value = score.score >= 68 ? "Confirmed" : score.score >= 52 ? "Partial" : "Needed";
  return {
    label: "Confirmation",
    score: score.score,
    tone: score.tone,
    value,
  };
}

function chaseRiskMetric(score: ExecutionScore): ActionabilityMetric {
  const value = score.score >= 72 ? "Avoid chase" : score.score >= 55 ? "Risk rising" : "Contained";
  return {
    label: "Chase risk",
    score: score.score,
    tone: score.tone,
    value,
  };
}

function timingMetric(score: number): ActionabilityMetric {
  return {
    label: "Entry quality",
    score,
    tone: score >= 68 ? "positive" : score >= 52 ? "neutral" : "caution",
    value: score >= 68 ? "Clean" : score >= 52 ? "Mixed" : "Needs patience",
  };
}

function scoreMetric(score: ExecutionScore): ActionabilityMetric {
  return {
    label: score.label,
    score: score.score,
    tone: score.tone,
    value: score.score >= 68 ? "Favorable" : score.score >= 52 ? "Mixed" : "Developing",
  };
}
