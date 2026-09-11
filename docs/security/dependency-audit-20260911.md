# TradeVeto — frontend dependency audit, triaged by reachability

**Date** 2026-09-11 · **Source** `npm audit --omit dev` on the production
dependency tree (prod host, registry-connected) · resolves the "provisional P1"
left open in `security-assessment-20260911.md`.

`npm audit` reports **17 vulnerabilities (1 critical, 6 high, 9 moderate, 1
low)** — all in the production tree (`--omit dev` returns the same 17, so none
are dev-only). Raw severity is the library's; the ratings below are adjusted for
whether the vulnerable path is actually reachable in this app.

## P1 — Next.js 16.2.6 (the critical)

`next` is pinned at **16.2.6**; the advisory range covers it, fixed in
**16.3.4**. Eleven CVEs. Reachability, checked against this app:

- **NOT reachable — Unauthenticated RCE on Windows hosts** (GHSA-p293-qw3h-jr36):
  production runs Linux (`node:22-bookworm-slim`).
- **NOT reachable — Unauthenticated RCE via AVIF in Image Optimization**
  (GHSA-2xp9-vwfh-vxw4): there is no `images` block in `next.config.ts`, so
  `next/image` uses default `formats`, which do **not** include AVIF. AVIF must
  be explicitly enabled to reach this.
- **Reachable / plausible** and the reason this is still P1: SSRF in rewrites and
  Server Actions (GHSA-p9j2-gv94-2wf4, GHSA-89xv-2m56-2m9x); cache confusion of
  response bodies (GHSA-68g3-v927-f742, GHSA-4633-3j49-mh5q); DoS in Image
  Optimization via SVG (GHSA-q8wf-6r8g-63ch) and in Server Actions
  (GHSA-m99w-x7hq-7vfj); **unauthenticated disclosure of internal Server
  Function endpoints** (GHSA-955p-x3mx-jcvp).

**Net: P1, not P0** — the two remote-code-execution CVEs do not apply here, so
this is "patch promptly," not "active RCE emergency." The fix also clears two
highs that chain underneath `next`: **postcss** and **sharp**.

- **Fix**: `next@16.3.4` (same major; a minor security release).

## P2 — nodemailer

Used server-side in `src/lib/server/email.ts` and
`src/lib/alerting/external-alerts.ts` (`createTransport` / `sendMail`). The
advisories that matter here are CRLF header injection (GHSA-268h-hp4c-crq3),
SSRF / arbitrary file read via the raw/message options
(GHSA-p6gq-j5cr-w38f, GHSA-8m3c-c648-2xjj), and recipient-domain allow-list
bypass (GHSA-wmmp-3585-3rmp, GHSA-cc9r-2j5m-2m83).

- **Reachability**: real if any user-influenced value (symbol, watchlist label,
  address) reaches a mail header, recipient, or the raw option. Alert emails do
  include app data. Needs a call-site review of what is user-controlled.
- **Rating: P2** — server-side, plausible but not confirmed user-controlled.
- **Fix**: `nodemailer@10.0.3` (breaking — review call sites).

## P3 — reachability low, fix when convenient

| Package | Issue | Why P3 here |
|---|---|---|
| echarts <6.1.0 | XSS (GHSA-fgmj-fm8m-jvvx) | Fed TradeVeto's own scanner/analytics data via `lib/echarts-options`, not user-generated content. Fix `echarts@6.1` (breaking) |
| csv-parse <7.0.2 | prototype pollution | No user-uploaded-CSV parse path found on the API/client; internal data. Fix `csv-parse@7.0.2` (breaking) |
| sharp | libvips/libheif CVEs | Image processing under `next/image`; cleared by the `next` bump |
| postcss | source-map path traversal | Build-time; cleared by the `next` bump |
| brace-expansion, browserslist, nanoid | DoS / OOM | Deep transitive, low reach; non-breaking fix available |
| baseline-browser-mapping, @babel/core, @opentelemetry/core | DoS / build-time file read | Low reach; non-breaking or chained |

## Remediation — run on a registry-connected machine, in `frontend/`

This environment cannot apply these: the checkout I can commit from has no npm
registry access, and the 476 KB `package-lock.json` exceeds the ops relay's
200 KB output cap, so a prod-generated lockfile can't be shuttled back. The
version bumps must be generated where npm can reach the registry (e.g. the Mac
real terminal), committed, and pushed — then the standard prod flow applies.

```bash
cd frontend

# Tier A — safe, non-breaking (npm-sanctioned in-range fixes):
#   clears @babel/core, brace-expansion, browserslist, nanoid, baseline-browser-mapping
npm audit fix

# Tier B — the critical, same-major security release:
#   clears next + postcss + sharp
npm install next@16.3.4

# verify before shipping
npm run build
npm test        # (or the project's test runner)
```

Tier A + B is the high-value, low-risk batch. Ship it through the normal flow:
commit `frontend/package.json` + `frontend/package-lock.json` (**image inputs →
rebuild + deploy required**), push, then I drive prod pull → rebuild → deploy →
smoke → browser verify.

```bash
# Tier C — breaking majors, one at a time, adapt call sites, re-run build + tests:
npm install nodemailer@10.0.3     # review mail header/recipient construction
npm install echarts@6.1.0         # chart option API changes
npm install csv-parse@7.0.2       # parser API changes
npm install @sentry/nextjs@10.74.0
```

## What I can and cannot do from here

- **Can**: enumerate, triage by reachability (this document), and drive the
  entire prod side once the dependency change is on the remote — pull, rebuild,
  deploy, smoke, browser-verify.
- **Cannot**: generate the version bumps / lockfile — no registry on the commit
  checkout, and the lockfile is too large to move through the relay. Same class
  of infrastructural wall as the GitHub push block; not a permissions gap.
