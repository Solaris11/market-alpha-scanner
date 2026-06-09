# Phase 35.0A - Production Performance Root Cause Elimination

Generated: 2026-06-09

Production target: `https://tradeveto.com`

Production checkout after remediation: `0740363`

Final verdict: **PARTIALLY FIXED**

This phase identified and remediated the acute production degradation causes. It does not certify full root-cause elimination because the requested 1h/6h/24h memory observations have not elapsed and the production browser performance probe still reports route/workflow blockers.

## Executive Summary

TradeVeto was not down because of a single broken page route. The strongest evidence points to two acute production stressors:

1. A full-scan analysis job entered an unbounded high-memory/high-CPU forward-return analysis path.
2. Heavy crawler traffic amplified dynamic public route work through the Cloudflare/Caddy path while the host was resource pressured.

Immediate remediations are deployed:

- Full analysis now has snapshot, signal-row, and time guardrails.
- Normal scheduled analysis canonicalizes signal rows before expensive horizon work.
- Snapshot loading now reads only analysis/lifecycle-relevant CSV columns.
- The scanner-job container is capped at `1.5` CPUs and `2 GiB` memory.
- Production Caddy now throttles heavy AI/SEO crawler user agents for TradeVeto dynamic routes.

Representative production proof after fixes:

- Full-universe scanner proof completed in `212.6s`.
- Guarded analysis completed in `102.6s`.
- `1800` snapshots loaded.
- `199,770` input signal rows canonicalized to `2,220` signal rows before horizon work.
- `8,482` forward-return observations produced.
- Scanner job memory sample during analysis stayed at `719.3 MiB / 2 GiB`.
- Production smoke after proof returned HTTP 200 for all checked routes.

## Root Causes

| Severity | Issue | Evidence | Fix | Verification |
| --- | --- | --- | --- | --- |
| Critical | Unbounded full-scan analysis work | `market-alpha-full-scan.service` runs `--run-analysis`; June 5 analysis took `25052.3s`; June 8/9 run failed with `status=137`; live incident container was observed at roughly 101% CPU and multi-GiB memory. | Added analysis time/snapshot/signal guardrails; canonical signal sampling before horizon work; column-pruned snapshot reads; scanner-job CPU/memory limits. | Full-universe proof completed under the 2 GiB cap; analysis `102.6s`; peak sampled memory `719.3 MiB`. |
| Critical | Crawler amplification under resource pressure | Caddy logs showed heavy GPTBot traffic against dynamic `/macro?...tv_share=...` URLs; before mitigation public browser/curl route timings were multi-second to timeout while direct origin was fast. | Production Caddy matcher returns `429` for heavy crawler UAs including GPTBot, ChatGPT-User, CCBot, ClaudeBot, PerplexityBot, Bytespider, AhrefsBot, SemrushBot, DotBot, MJ12bot. | Public route smoke returned sub-second totals for core routes after throttle; bot test returned `429`; direct origin remained tens of milliseconds. |
| High | Browser workflow proof still not ready | Fresh Playwright browser probe status: `not_ready`. Chromium failed `/scanner` and `/market-memory`; Firefox/WebKit failed `/terminal` target; unauthenticated interaction probes could not find protected workflow controls. | Not fully fixed in this phase. Requires separate browser route/workflow remediation and authenticated probe split. | Artifact: `docs/ops/artifacts/phase-35-0a-performance-root-cause/browser-performance/full-platform-browser-performance.json`. |
| Medium | Monitoring table growth and repeated metric scans remain watch items | `request_metrics` table sampled at about `1700 MB`; DB was not locked, but the volume is material. | No schema change in this phase. Existing rollups should be audited for retention and dashboard query shape. | DB sample showed no lock waits and database cache hit `95.22%`. |
| Medium | Long-duration memory certification incomplete | Only incident, proof-run, and short post-deploy samples were captured. | Need 1h/6h/24h observation window before full certification. | Current short samples are healthy; final certification remains partial. |

## Production Profiling

### Container State

Post-remediation production containers:

| Container | Status | Sample CPU | Sample memory |
| --- | --- | ---: | ---: |
| `market-alpha-frontend` | healthy | `32.80%` | `568.4 MiB` |
| `market-alpha-frontend-hot-api` | healthy | `0.00%` | `375.1 MiB` |
| `market-alpha-postgres` | healthy | `8.19%` | `245.4 MiB` |
| `hdsm-caddy` | healthy | `0.91%` | `21.82 MiB` |

No scanner-job container was running after the proof.

### Route Smoke

Post-proof public smoke:

| Route | Status | TTFB | Total |
| --- | ---: | ---: | ---: |
| `/api/health` | 200 | `0.113s` | `0.113s` |
| `/api/health/deep` | 200 | `0.131s` | `0.132s` |
| `/` | 200 | `0.202s` | `0.702s` |
| `/terminal` | 200 | `0.318s` | `0.407s` |
| `/discover` | 200 | `0.101s` | `0.261s` |
| `/scanner` | 200 | `0.115s` | `0.206s` |
| `/symbol/AMD` | 200 | `0.118s` | `0.290s` |
| `/history` | 200 | `0.104s` | `0.204s` |
| `/performance` | 200 | `0.106s` | `0.167s` |
| `/feed` | 200 | `0.190s` | `0.376s` |
| `/alerts` | 200 | `0.105s` | `0.179s` |
| `/account` | 200 | `1.415s` | `1.453s` |

The `/account` slow sample did not reproduce in three immediate follow-up samples: totals were `0.315s`, `0.210s`, and `0.153s`.

Direct origin through local Caddy before final deploy was consistently faster, with core pages mostly in `0.012s` to `0.111s` total. That supports the finding that public path degradation was traffic/resource-amplification driven, not a persistent SSR failure.

## Browser Timing Probe

Artifact: `docs/ops/artifacts/phase-35-0a-performance-root-cause/browser-performance/full-platform-browser-performance.json`

Overall status: `not_ready`

Selected route results:

| Browser | Route | Interactive | TTFB | Status |
| --- | --- | ---: | ---: | --- |
| Chromium | `/terminal` | `799.795ms` | `271ms` | pass |
| Chromium | `/scanner` | `4810.594ms` | `4446ms` | fail |
| Chromium | `/market-memory` | `2674.454ms` | `2074ms` | fail |
| Firefox | `/terminal` | `3099.031ms` | `456ms` | fail |
| Firefox | `/scanner` | `729.191ms` | `216ms` | pass |
| WebKit | `/terminal` | `2190.948ms` | unreliable negative timing sample | fail |
| WebKit | `/symbol/AMD` | `355.356ms` | `65ms` | pass |

Interaction proof caveat:

- Several Chromium interaction failures were selector timeouts on unauthenticated pages, including scanner filter, compare, chart restore, fullscreen chart, symbol switch, and symbol search.
- This is still a product performance/probe blocker. It needs an authenticated workflow probe split from public route smoke.

## Background Job Audit

Fast scan:

- Timer: every 15 minutes.
- Recent runs completed in roughly `39s-45s`.
- Uses `--fast --timing --outdir /app/scanner_output`.

Full scan:

- Timer: weekdays at `21:30 UTC`.
- Previous command ran `--run-analysis --timing --outdir /app/scanner_output`.
- The old unbounded analysis path was the primary operational risk.

Deployed guardrails:

- `--analysis-time-budget-seconds`, default `900`.
- `--analysis-max-snapshots`, default `1800`.
- `--analysis-max-signal-rows`, default `25000`.
- Normal non-raw analysis canonicalizes daily signal rows before horizon work.
- `--analysis-raw` remains available for intentionally exhaustive offline use.
- `market-alpha-scanner-job` now has `cpus: "1.5"` and `mem_limit: 2g`.

Representative proof:

- First full-universe proof under `2 GiB` hit `status=137` before column pruning, proving the resource ceiling protected the host but the loader still over-allocated.
- After column pruning, the same 1800-snapshot full-universe proof passed.

## Database Audit

Production DB sample:

- Active connections sample: `10`.
- Lock waits: none.
- Current active app queries: none beyond the sampling query.
- Database cache hit: `95.22%`.

Largest/hottest sampled tables:

| Table | Approx size | Notes |
| --- | ---: | --- |
| `scanner_signals` | `2877 MB` | Hot indexed scanner table. |
| `request_metrics` | `1700 MB` | Needs retention/rollup audit. |
| `market_memory_snapshots` | `1087 MB` | Hot indexed memory table. |
| `symbol_snapshots` | `989 MB` | Hot indexed symbol table. |
| `forward_returns` | `328 MB` | Analysis output table. |

Conclusion:

- No evidence of DB lock saturation during the incident window sample.
- DB remains a medium optimization area due table growth, but not the acute outage root cause.

## Cache Audit

Evidence captured:

- Production DB cache hit sample: `95.22%`.
- Recent fast scan logs showed fundamentals cache hits before the incident, but the representative proof intentionally had `fundamentals hits=0 misses=111` because it ran in an isolated temporary proof path.
- Verified event context was available and refreshed during proof runs.

Remaining gap:

- The app does not expose a complete cache hit/miss dashboard for all route/API/discovery/symbol/provider caches in one place. This remains a medium observability gap.

## Bot and Crawler Resilience

Observed problem:

- Heavy crawler traffic targeted dynamic public URLs while the host was under analysis-job resource pressure.

Mitigation:

- Production Caddy now throttles heavy crawler user agents for TradeVeto with `429` and `Retry-After`.

Boundary:

- This is a production Caddy remediation, not a repo-tracked Caddyfile change.
- Social/legitimate crawlers are still handled by app policy tests; this throttle is aimed at high-cost AI/SEO crawler classes.

## Memory Leak Detection

Completed:

- Incident memory spike identified and linked to full-scan analysis.
- Scanner-job proof samples under resource limit:
  - Scoring sample: `169.6 MiB / 2 GiB`.
  - Mid-scoring sample: `181.7 MiB / 2 GiB`.
  - Analysis sample after 1800-snapshot load: `534 MiB / 2 GiB`.
  - Lifecycle sample: `719.3 MiB / 2 GiB`.
- Post-proof app containers were stable.

Not completed:

- 1-hour observation.
- 6-hour observation.
- 24-hour observation.

This is why the final verdict remains **PARTIALLY FIXED**.

## Validation

Local validation:

- `PYTHONPATH=. pytest -q tests/test_forward_validation.py`: `7 passed`.
- `python3 -m py_compile $(git ls-files '*.py')`: pass.
- `npx pyright . --pythonpath .venv/bin/python --warnings`: `0 errors`.
- `npm --prefix frontend run lint`: pass.
- `npm --prefix frontend test -- --runInBand`: `572 passed`.
- `npm --prefix frontend run build`: pass.
- `npm --prefix frontend audit --omit=dev`: `found 0 vulnerabilities`.
- `git diff --check`: pass.

Production deployment:

- Pushed commits:
  - `a21afa71` - scanner analysis guardrails.
  - `c3e282c` - scanner-job resource limits.
  - `0740363` - analysis snapshot column pruning.
- Production pulled `0740363`.
- Rebuilt `market-alpha-scanner-job`.
- Frontend rebuild was not required for the Python scanner-job fix.
- Production route smoke passed.

## Remaining Blockers

Critical blockers resolved:

- Host-threatening scanner analysis runaway is bounded and verified under representative production proof.
- Heavy crawler amplification is throttled at Caddy.

High blockers remaining:

- Browser workflow performance probe is still `not_ready`.
- Authenticated browser workflow proof must be separated from public unauthenticated route smoke.
- The requested 1h/6h/24h memory observations are not complete.

Medium blockers remaining:

- `request_metrics` growth and rollup retention need continued review.
- Complete cache hit/miss instrumentation across app caches is incomplete.
- Full scheduled run should be watched at the next real `market-alpha-full-scan.timer` execution.

## Final Verdict

**PARTIALLY FIXED**

The acute production degradation root causes were identified and materially remediated. TradeVeto is no longer in the observed down/degraded state, and the scanner-job runaway path is bounded by algorithmic, I/O, time, and container guardrails. Full root-cause elimination is not certified until long-duration memory observation and browser workflow blockers are cleared.
