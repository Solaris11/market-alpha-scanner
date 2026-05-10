import "server-only";

import { getActiveAlertMatches } from "@/lib/active-alert-matches";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getRecentIntradaySignalDriftSummary } from "@/lib/scanner-data";
import { buildLiveIntelligenceSystem } from "@/lib/trading/live-intelligence";
import { buildMobileIntelligenceCenter, type MobileIntelligenceCenter, type MobileIntelligencePacket } from "@/lib/trading/mobile-push-intelligence";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";
import { listEnabledPushSubscriptions, logMobilePushIntelligenceEvent, type PushAlertPreferenceKey, type StoredPushSubscription } from "./push-subscriptions";
import { sendMobileWebPush } from "./web-push";
import { readUserWatchlist } from "./user-watchlist";
import { getWorkflowEvolutionForUser } from "./workflow-evolution";

export type MobilePushDeliverySummary = {
  attempted: number;
  delivered: number;
  eligiblePackets: number;
};

export async function loadMobileIntelligenceCenter(userId: string): Promise<MobileIntelligenceCenter> {
  const adapter = new ScannerDataAdapter();
  const [rows, driftRows, watchlistSymbols, alertMatches] = await Promise.all([
    adapter.getOverviewSignals().catch(() => []),
    getRecentIntradaySignalDriftSummary({ hours: 8, maxRuns: 24, minRuns: 2 }).catch(() => []),
    readUserWatchlist(userId).catch(() => []),
    getActiveAlertMatches(userId).then((response) => response.matches).catch(() => []),
  ]);
  const model = buildOpportunitiesPageModel(rows, null);
  const workflow = await getWorkflowEvolutionForUser(userId, rows, { surface: "terminal", watchlistSymbols }).catch(() => null);
  const live = buildLiveIntelligenceSystem({
    driftRows,
    rows: model.rows,
    streamMode: "snapshot",
  });
  return buildMobileIntelligenceCenter({
    alertMatches,
    live,
    rows: model.rows,
    watchlistSymbols,
    workflow,
  });
}

export async function sendMobileIntelligencePushesForUser(userId: string, center?: MobileIntelligenceCenter): Promise<MobilePushDeliverySummary> {
  const intelligence = center ?? await loadMobileIntelligenceCenter(userId);
  const subscriptions = await listEnabledPushSubscriptions(userId).catch(() => []);
  const packets = intelligence.packets.filter((packet) => packet.pushEligible).slice(0, 4);
  let attempted = 0;
  let delivered = 0;

  for (const packet of packets) {
    const eligibleSubscriptions = subscriptions.filter((subscription) => preferenceAllows(subscription, packet));
    if (!eligibleSubscriptions.length) continue;
    await logMobilePushIntelligenceEvent(userId, {
      actionUrl: packet.actionUrl,
      eventType: packet.category,
      message: packet.body,
      payload: { evidenceLabel: packet.evidenceLabel, reasonCodes: packet.reasonCodes, score: packet.score, symbol: packet.symbol },
      priority: packet.priority,
      title: packet.title,
    }).catch(() => undefined);
    const results = await Promise.all(
      eligibleSubscriptions.map((subscription) =>
        sendMobileWebPush(subscription, {
          body: packet.body,
          tag: `tradeveto-${packet.category}-${packet.symbol ?? "market"}`,
          title: packet.title,
          url: packet.actionUrl,
        }),
      ),
    );
    attempted += results.length;
    delivered += results.filter((result) => result.ok).length;
  }

  return {
    attempted,
    delivered,
    eligiblePackets: packets.length,
  };
}

function preferenceAllows(subscription: StoredPushSubscription, packet: MobileIntelligencePacket): boolean {
  const key = preferenceKeyFor(packet.category);
  return key ? subscription.preferences[key] : true;
}

function preferenceKeyFor(category: MobileIntelligencePacket["category"]): PushAlertPreferenceKey | null {
  if (category === "watchlist") return "watchlist";
  if (category === "shock") return "shock";
  if (category === "macro") return "macro";
  if (category === "fragility") return "fragility";
  if (category === "what_changed") return "whatChanged";
  if (category === "replay") return "replay";
  return null;
}
