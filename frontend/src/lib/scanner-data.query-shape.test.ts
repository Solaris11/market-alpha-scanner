import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

/**
 * Two query shapes on the /terminal path are load-bearing for reasons that are
 * invisible in the SQL itself, so they are pinned here.
 *
 * This asserts the shape of the SQL, not its result -- these tests cannot run
 * against a database. The proof that the shapes are faster is the prod
 * EXPLAIN (ANALYZE, BUFFERS) output recorded in
 * docs/analysis/terminal-server-timeline.md. What this catches is the
 * regression: someone folding the count back into the data query, or deleting
 * the "redundant" LIMIT, and quietly restoring a 3.6s and a 405ms query.
 */

const SOURCE = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "scanner-data.ts"), "utf8");

function block(startMarker: string, endMarker: string): string {
  const start = SOURCE.indexOf(startMarker);
  assert.notEqual(start, -1, `could not find ${startMarker} -- this test needs updating`);
  const end = SOURCE.indexOf(endMarker, start);
  assert.notEqual(end, -1, `could not find ${endMarker} after ${startMarker}`);
  // Comments in this region explain the very patterns being asserted against,
  // so they have to come out or the test matches its own documentation.
  return SOURCE.slice(start, end)
    .split("\n")
    .filter((line) => !/^\s*(\/\/|--)/.test(line))
    .join("\n");
}

describe("forward_returns query shape", () => {
  const performanceBlock = block("const getDbPerformanceData = cache(", "const getDbSymbolSummary = cache(");

  // Postgres evaluates window functions before LIMIT. `count(*) OVER ()` on the
  // row query therefore pushed all 818k matching rows through a WindowAgg and
  // spilled ~1.3GB to temp files; the LIMIT bought nothing. Prod: 3652ms.
  test("the row query does not carry a window-function total", () => {
    assert.equal(/count\(\*\)\s*OVER\s*\(/i.test(performanceBlock), false, "count(*) OVER () makes LIMIT useless on forward_returns -- keep the total in its own query");
  });

  test("the row query still bounds itself with LIMIT", () => {
    assert.match(performanceBlock, /FROM forward_returns[\s\S]*?LIMIT \$1/i);
  });

  // The total is not optional: it feeds lineCount, which /paper renders as
  // "completed evidence samples". It just has to be cheap. Prod: 115ms.
  test("the total is still fetched, over exactly the same population", () => {
    assert.match(performanceBlock, /SELECT count\(\*\) AS total_count\s*\n\s*FROM forward_returns\s*\n\s*WHERE return_pct IS NOT NULL/i);
    const whereClauses = performanceBlock.match(/FROM forward_returns\s*\n\s*WHERE return_pct IS NOT NULL/gi) ?? [];
    assert.equal(whereClauses.length, 2, "the count and the rows must share one WHERE clause, or lineCount describes a different population than the rows");
  });

  test("a failed count degrades lineCount instead of losing the rows", () => {
    assert.match(performanceBlock, /dbQuery<DbForwardCountRow>\([\s\S]*?\)\.catch\(\(\) => null\)/);
    assert.match(performanceBlock, /dbCount\(forwardCountResult\?\.rows\[0\]\?\.total_count\)/);
  });
});

describe("recent scanner history query shape", () => {
  const historyBlock = block("const getRecentDbHistoryRows = cache(", "export async function getRecentScannerHistoryRows");

  // Without this LIMIT the planner estimated 6048 runs instead of 18 and chose a
  // sequential scan of all 2.93M scanner_signals rows (790MB) to find 6.4k of
  // them: 405ms and 101,781 buffers. With it: 7.6ms and 504 buffers, using
  // idx_scanner_signals_scan_run_id.
  test("bounded_runs pins its own row count for the planner", () => {
    assert.match(historyBlock, /bounded_runs AS \([\s\S]*?LIMIT \$1\s*\n\s*\)/, "bounded_runs must end with LIMIT $1 or the planner sequentially scans scanner_signals");
  });

  test("the LIMIT cannot drop a qualifying run", () => {
    // rn <= $1 already caps the set at $1 rows, so LIMIT $1 is a no-op for
    // correctness. If the rn bound ever stops matching the LIMIT, that stops
    // being true and this test should be the thing that notices.
    assert.match(historyBlock, /WHERE rn <= \$1/);
    assert.match(historyBlock, /LIMIT \$1/);
  });
});
