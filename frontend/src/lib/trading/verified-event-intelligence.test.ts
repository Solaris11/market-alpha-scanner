import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RankingRow } from "@/lib/types";
import { buildVerifiedEventContext, eventReasonLabel, eventTone } from "./verified-event-intelligence";

describe("verified event intelligence", () => {
  it("builds compact risk context from scanner event fields", () => {
    const row = {
      event_context_available: true,
      event_context_label: "Macro Event Pressure",
      event_context_reason_codes: ["EVENT_INFLATION_PRESSURE", "EVENT_RISK_ELEVATED"],
      event_context_summary: "Macro Event Pressure: 2 verified event items mapped to this setup. This is probabilistic context, not a forecast.",
      event_conviction_adjustment: -1.2,
      event_fragility_adjustment: 3.1,
      event_macro_pressure_adjustment: -1.6,
      event_risk_score: 73,
      event_shock_pressure_score: 68,
      verified_event_feed_disclosure: "Verified event providers returned source-linked items in the current packet.",
      verified_event_feed_status: "active",
      symbol: "DDOG",
      verified_event_pressure_score: 70,
      verified_event_recent_events: [
        {
          event_type: "inflation",
          published_at: "2026-05-08T12:00:00Z",
          reason_codes: ["EVENT_INFLATION_PRESSURE"],
          scope: "broad",
          source: "Bureau of Labor Statistics",
          source_url: "https://www.bls.gov/example",
          title: "Consumer price index update",
          weight: 0.48,
        },
      ],
      verified_event_sources_used: ["Bureau of Labor Statistics"],
    } as unknown as RankingRow;

    const context = buildVerifiedEventContext(row);

    assert.equal(context.available, true);
    assert.equal(context.compactLabel, "Event Risk Elevated");
    assert.equal(eventTone(context), "risk");
    assert.equal(context.feedStatus, "active");
    assert.match(context.feedDisclosure, /source-linked/);
    assert.equal(context.recentEvents[0]?.source, "Bureau of Labor Statistics");
    assert.match(eventReasonLabel("EVENT_INFLATION_PRESSURE"), /inflation/i);
    assert.doesNotMatch(context.summary.toLowerCase(), /guarantee|buy now|sell now/);
  });

  it("degrades gracefully when no verified events are available", () => {
    const context = buildVerifiedEventContext({ symbol: "SPY" } as RankingRow);

    assert.equal(context.available, false);
    assert.equal(context.riskScore, 50);
    assert.equal(eventTone(context), "muted");
    assert.equal(context.recentEvents.length, 0);
  });
});
