export type RevenueValidationStatus = "ready" | "strong_partial" | "not_ready";

export type RevenueFunnelInput = {
  activatedUsers: number;
  freeUsers: number;
  freeToPaidConversions: number;
  paidUsers: number;
  retainedPaidUsers: number;
  signups: number;
  trialToPaidConversions: number;
  trialUsers: number;
  visitorActors: number;
};

export type RevenueEconomicsInput = {
  campaignPaidConversions: number;
  campaignRevenueCents: number | null;
  campaignSpendCents: number | null;
  ltvBaselineCents: number | null;
  monthlyPriceCents: number | null;
  mrrCents: number | null;
};

export type AcquisitionCampaignInput = {
  campaign: string;
  paidConversions: number;
  revenueCents: number | null;
  signups: number;
  source: string;
  spendCents: number | null;
  visitors: number;
};

export type RevenueValidationInput = {
  campaigns: AcquisitionCampaignInput[];
  economics: RevenueEconomicsInput;
  funnel: RevenueFunnelInput;
  generatedAt: string;
  lookbackDays: number;
};

export type RevenueRateSummary = {
  freeToPaidPct: number | null;
  paidRetentionPct: number | null;
  signupToActivatedPct: number | null;
  trialToPaidPct: number | null;
  visitorToSignupPct: number | null;
};

export type RevenueEconomicsSummary = {
  arpuCents: number | null;
  arrCents: number | null;
  cacCents: number | null;
  campaignRevenueCents: number | null;
  campaignSpendCents: number | null;
  ltvBaselineCents: number | null;
  monthlyPriceCents: number | null;
  mrrCents: number | null;
};

export type RevenueValidationReport = {
  blockers: string[];
  campaigns: AcquisitionCampaignInput[];
  economics: RevenueEconomicsSummary;
  funnel: RevenueFunnelInput;
  generatedAt: string;
  gates: {
    arpuBaseline: boolean;
    firstPaidCustomers: boolean;
    freeToPaidEvidence: boolean;
    ltvBaseline: boolean;
    realAcquisitionCampaignEvidence: boolean;
    trialToPaidEvidence: boolean;
  };
  lookbackDays: number;
  noSyntheticRevenueDataCreated: true;
  proofBoundary: string;
  rates: RevenueRateSummary;
  status: RevenueValidationStatus;
};

export function buildRevenueValidationReport(input: RevenueValidationInput): RevenueValidationReport {
  const funnel = normalizeFunnel(input.funnel);
  const monthlyPriceCents = normalizeNullableMoney(input.economics.monthlyPriceCents);
  const explicitMrrCents = normalizeNullableMoney(input.economics.mrrCents);
  const mrrCents = explicitMrrCents ?? (monthlyPriceCents === null ? null : monthlyPriceCents * funnel.paidUsers);
  const arpuCents = mrrCents === null || funnel.paidUsers <= 0 ? null : Math.round(mrrCents / funnel.paidUsers);
  const arrCents = mrrCents === null ? null : mrrCents * 12;
  const campaignSpendCents = normalizeNullableMoney(input.economics.campaignSpendCents);
  const campaignRevenueCents = normalizeNullableMoney(input.economics.campaignRevenueCents);
  const campaignPaidConversions = Math.max(0, Math.trunc(input.economics.campaignPaidConversions));
  const cacCents = campaignSpendCents === null || campaignPaidConversions <= 0 ? null : Math.round(campaignSpendCents / campaignPaidConversions);
  const ltvBaselineCents = normalizeNullableMoney(input.economics.ltvBaselineCents);
  const campaigns = input.campaigns.map(normalizeCampaign);
  const rates = {
    freeToPaidPct: percent(funnel.freeToPaidConversions, funnel.freeUsers),
    paidRetentionPct: percent(funnel.retainedPaidUsers, funnel.paidUsers),
    signupToActivatedPct: percent(funnel.activatedUsers, funnel.signups),
    trialToPaidPct: percent(funnel.trialToPaidConversions, funnel.trialUsers),
    visitorToSignupPct: percent(funnel.signups, funnel.visitorActors),
  };
  const gates = {
    arpuBaseline: arpuCents !== null,
    firstPaidCustomers: funnel.paidUsers > 0,
    freeToPaidEvidence: funnel.freeToPaidConversions > 0,
    ltvBaseline: ltvBaselineCents !== null,
    realAcquisitionCampaignEvidence: campaigns.some((campaign) => campaign.visitors > 0 || campaign.signups > 0 || campaign.paidConversions > 0 || (campaign.spendCents ?? 0) > 0),
    trialToPaidEvidence: funnel.trialToPaidConversions > 0,
  };
  const economics = {
    arpuCents,
    arrCents,
    cacCents,
    campaignRevenueCents,
    campaignSpendCents,
    ltvBaselineCents,
    monthlyPriceCents,
    mrrCents,
  };
  const blockers = revenueBlockers(gates, economics);
  return {
    blockers,
    campaigns,
    economics,
    funnel,
    generatedAt: input.generatedAt,
    gates,
    lookbackDays: Math.max(1, Math.trunc(input.lookbackDays)),
    noSyntheticRevenueDataCreated: true,
    proofBoundary: "Revenue validation reads first-party analytics, live-mode Stripe subscription state, billing lifecycle events, and explicit campaign metadata only. It does not create customers, backfill conversions, infer paid users from test-mode subscriptions, or fabricate campaign spend.",
    rates,
    status: blockers.length === 0 ? "ready" : hasPartialRevenueEvidence(funnel, campaigns) ? "strong_partial" : "not_ready",
  };
}

function revenueBlockers(gates: RevenueValidationReport["gates"], economics: RevenueEconomicsSummary): string[] {
  const blockers: string[] = [];
  if (!gates.firstPaidCustomers) blockers.push("No live paid customers are proven.");
  if (!gates.trialToPaidEvidence) blockers.push("No trial-to-paid conversion evidence is proven.");
  if (!gates.freeToPaidEvidence) blockers.push("No free-to-paid conversion evidence is proven.");
  if (!gates.arpuBaseline) blockers.push("ARPU is unproven because no trusted live MRR or monthly price amount is available.");
  if (!gates.ltvBaseline) blockers.push("LTV baseline is unproven because no retained paid renewal/churn evidence is available.");
  if (!gates.realAcquisitionCampaignEvidence) blockers.push("No real acquisition campaign traffic, conversion, cost, or revenue evidence is present.");
  if (gates.realAcquisitionCampaignEvidence && economics.cacCents === null) blockers.push("CAC is unproven because campaign spend and paid conversion evidence are incomplete.");
  return blockers;
}

function hasPartialRevenueEvidence(funnel: RevenueFunnelInput, campaigns: AcquisitionCampaignInput[]): boolean {
  return funnel.visitorActors > 0 || funnel.signups > 0 || funnel.activatedUsers > 0 || funnel.trialUsers > 0 || funnel.paidUsers > 0 || campaigns.length > 0;
}

function normalizeFunnel(funnel: RevenueFunnelInput): RevenueFunnelInput {
  return {
    activatedUsers: nonNegativeInteger(funnel.activatedUsers),
    freeUsers: nonNegativeInteger(funnel.freeUsers),
    freeToPaidConversions: nonNegativeInteger(funnel.freeToPaidConversions),
    paidUsers: nonNegativeInteger(funnel.paidUsers),
    retainedPaidUsers: nonNegativeInteger(funnel.retainedPaidUsers),
    signups: nonNegativeInteger(funnel.signups),
    trialToPaidConversions: nonNegativeInteger(funnel.trialToPaidConversions),
    trialUsers: nonNegativeInteger(funnel.trialUsers),
    visitorActors: nonNegativeInteger(funnel.visitorActors),
  };
}

function normalizeCampaign(campaign: AcquisitionCampaignInput): AcquisitionCampaignInput {
  return {
    campaign: boundedText(campaign.campaign, "unknown"),
    paidConversions: nonNegativeInteger(campaign.paidConversions),
    revenueCents: normalizeNullableMoney(campaign.revenueCents),
    signups: nonNegativeInteger(campaign.signups),
    source: boundedText(campaign.source, "unknown"),
    spendCents: normalizeNullableMoney(campaign.spendCents),
    visitors: nonNegativeInteger(campaign.visitors),
  };
}

function boundedText(value: string, fallback: string): string {
  const text = value.trim().replace(/[^A-Za-z0-9._:/ -]/g, "").replace(/\s+/g, " ").slice(0, 80);
  return text || fallback;
}

function normalizeNullableMoney(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.trunc(value));
}

function nonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function percent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 10_000) / 100;
}
