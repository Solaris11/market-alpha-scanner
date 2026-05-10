import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TradeVetoApiError, TradeVetoClient } from "./tradeveto-sdk";

describe("TradeVeto developer SDK", () => {
  it("authenticates requests with a bearer token and builds feed URLs", async () => {
    const requests: Array<{ init?: RequestInit; url: string }> = [];
    const client = new TradeVetoClient({
      apiKey: "tvk_live_test",
      baseUrl: "https://tradeveto.example",
      fetchImpl: async (url: string | URL | Request, init?: RequestInit) => {
        requests.push({ init, url: String(url) });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });

    const payload = await client.opportunities({ limit: 5 });

    assert.deepEqual(payload, { ok: true });
    assert.equal(requests[0]?.url, "https://tradeveto.example/api/v1/opportunities?limit=5");
    assert.equal(requests[0]?.init?.method, "GET");
    assert.equal((requests[0]?.init?.headers as Record<string, string>).Authorization, "Bearer tvk_live_test");
  });

  it("posts portfolio scenario requests as JSON", async () => {
    const requests: Array<{ init?: RequestInit; url: string }> = [];
    const client = new TradeVetoClient({
      apiKey: "tvk_live_test",
      baseUrl: "https://tradeveto.example/",
      fetchImpl: async (url: string | URL | Request, init?: RequestInit) => {
        requests.push({ init, url: String(url) });
        return new Response(JSON.stringify({ ok: true, scenario: "qqq_down" }), { status: 200 });
      },
    });

    await client.portfolioScenario({
      accountValue: 100000,
      positions: [{ allocationPct: 40, symbol: "NVDA" }],
    });

    assert.equal(requests[0]?.url, "https://tradeveto.example/api/v1/portfolio/scenario");
    assert.equal(requests[0]?.init?.method, "POST");
    assert.equal((requests[0]?.init?.headers as Record<string, string>)["Content-Type"], "application/json");
    assert.equal(requests[0]?.init?.body, JSON.stringify({ accountValue: 100000, positions: [{ allocationPct: 40, symbol: "NVDA" }] }));
  });

  it("throws structured API errors without exposing the API key", async () => {
    const client = new TradeVetoClient({
      apiKey: "tvk_live_secret",
      fetchImpl: async () => new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 }),
    });

    await assert.rejects(client.macro(), (error: unknown) => {
      assert.equal(error instanceof TradeVetoApiError, true);
      if (!(error instanceof TradeVetoApiError)) return false;
      assert.equal(error.status, 403);
      assert.equal(JSON.stringify(error.body).includes("tvk_live_secret"), false);
      return true;
    });
  });
});
