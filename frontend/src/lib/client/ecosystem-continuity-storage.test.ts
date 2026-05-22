import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ECOSYSTEM_CONTINUITY_STORAGE_KEY,
  recordEcosystemContinuityRoute,
  sanitizeEcosystemContinuityStorageState,
  readEcosystemContinuityStorage,
  writeEcosystemContinuityStorage,
} from "@/lib/client/ecosystem-continuity-storage";

describe("ecosystem continuity storage", () => {
  test("sanitizes persisted route memory and rejects unsafe paths", () => {
    const state = sanitizeEcosystemContinuityStorageState({
      recentRoutes: [
        { group: "symbol", path: "/symbol/AMD", symbol: "amd", visitedAt: "2026-05-21T15:00:00.000Z" },
        { group: "scanner", path: "//evil.test", symbol: "BAD", visitedAt: "2026-05-21T15:00:00.000Z" },
        { group: "bad", path: "/terminal", symbol: "NVDA", visitedAt: "2026-05-21T15:00:00.000Z" },
      ],
      recentSymbols: ["nvda", "$bad symbol"],
      restoredAt: "bad-date",
      updatedAt: "2026-05-21T15:01:00.000Z",
    });

    assert.equal(state.recentRoutes.length, 1);
    assert.equal(state.recentRoutes[0]?.symbol, "AMD");
    assert.deepEqual(state.recentSymbols.slice(0, 2), ["NVDA", "BADSYMBOL"]);
    assert.equal(state.restoredAt, null);
    assert.equal(state.updatedAt, "2026-05-21T15:01:00.000Z");
  });

  test("records current route without duplicating route memory", () => {
    const storage = new MemoryStorage();
    const first = recordEcosystemContinuityRoute(storage, {
      group: "symbol",
      path: "/symbol/AMD?tab=research",
      visitedAt: "2026-05-21T15:00:00.000Z",
    });
    const second = recordEcosystemContinuityRoute(storage, {
      group: "symbol",
      path: "/symbol/AMD?tab=research",
      visitedAt: "2026-05-21T15:01:00.000Z",
    });

    assert.equal(first.recentRoutes.length, 1);
    assert.equal(second.recentRoutes.length, 1);
    assert.equal(second.recentRoutes[0]?.symbol, "AMD");
    assert.deepEqual(second.recentSymbols, ["AMD"]);
  });

  test("round-trips through a storage-like adapter", () => {
    const storage = new MemoryStorage();
    const ok = writeEcosystemContinuityStorage(storage, {
      recentRoutes: [{ group: "terminal", path: "/terminal", symbol: null, visitedAt: "2026-05-21T15:00:00.000Z" }],
      recentSymbols: ["AMD"],
      restoredAt: null,
      updatedAt: "2026-05-21T15:00:00.000Z",
      version: 1,
    });

    assert.equal(ok, true);
    assert.ok(storage.getItem(ECOSYSTEM_CONTINUITY_STORAGE_KEY));
    assert.equal(readEcosystemContinuityStorage(storage).recentRoutes[0]?.group, "terminal");
  });
});

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
