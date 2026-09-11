# TradeVeto — non-destructive security assessment

**Date** 2026-09-11 · **Target** `https://tradeveto.com` and its API (owner-authorized)
· **Type** non-destructive, read-only external + grey-box review · **Assessor** autonomous session

## Scope and method

Authorized assessment of the owner's own production site. Strictly
non-destructive: no login brute force, no high-volume fuzzing or DoS, no
injection that could write or delete data, no access to other users' data. Where
a weakness was probed, testing stopped at a read-only proof.

Vantage points used: `curl` header/endpoint probes from the production host (via
the ops relay), and the in-app browser (external desktop vantage, an
authenticated test-account session) for cookie, CSP and `.env`-exposure checks.
Deep TLS tooling (`nmap`, `testssl`, `openssl s_client`) was not available in the
permitted shells; TLS is fronted by Cloudflare, whose posture is partially
visible in the headers below.

## Headline

**No P0 or P1 issues were confirmed on the running site.** The application is
well hardened: HSTS preload, a real Content-Security-Policy, HttpOnly session
cookies, clean error handling, no source-control or environment-file exposure,
and correct authorization boundaries on protected endpoints. The one production
finding worth acting on is `'unsafe-inline'` in the CSP `script-src` (P2). The
only P1 is off the running site: a dependency-audit result from the build (1
critical, 6 high) that needs enumeration.

Severity key: **P0** exploitable now, serious impact · **P1** serious, needs
prompt action · **P2** real weakness, defense-in-depth · **P3** hardening /
best practice.

---

## Findings

### P1 — Dependency vulnerabilities in the frontend tree (off-site, from the build)

`npm ci` during the frontend image build reported **17 vulnerabilities: 1
critical, 6 high, 9 moderate, 1 low**. The specific packages were not
enumerated (that needs `npm audit`, which requires registry access the assessment
shells don't have).

- **Impact**: unknown until enumerated. A critical advisory in a production
  dependency is potentially serious, but real severity depends on the package
  and whether the vulnerable path is reachable. This rating is provisional and
  deliberately high until triaged.
- **Evidence**: build log, `frontend/Dockerfile` builder stage, 2026-09-11.
- **Remediation**: run `npm audit` in `frontend/`, enumerate the critical + 6
  high, and `npm audit fix` / bump the offending packages. This branch never
  touched `package.json` or the lockfile, so the finding predates this work.
- **Verify**: `cd frontend && npm audit --production`.

### P2 — CSP allows `'unsafe-inline'` in `script-src`

```
script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com
```

- **Impact**: `'unsafe-inline'` lets any injected inline `<script>` execute, which
  removes most of the XSS protection a CSP is there to provide. If an XSS sink
  exists anywhere in the app, the CSP would not contain it.
- **Mitigating context** (why this is P2, not P1): session cookies are HttpOnly
  (confirmed below), so an inline-script XSS cannot directly read the session
  cookie; and no reflected-XSS sink was found in this pass. The weakness is the
  missing layer, not a demonstrated exploit.
- **Remediation**: move to a nonce- or hash-based CSP. Next.js supports a
  per-request nonce; emit `script-src 'self' 'nonce-<random>'` and drop
  `'unsafe-inline'`. `style-src 'unsafe-inline'` (also present) is lower risk and
  can follow.
- **Verify**: after change, `curl -sI https://tradeveto.com/ | grep -i content-security` shows a nonce and no `'unsafe-inline'` in `script-src`.

### P3 — `.well-known/security.txt` missing

- `/.well-known/security.txt` returns 404. Adds friction to coordinated
  disclosure — a researcher has no listed contact.
- **Remediation**: publish an RFC 9116 `security.txt` with a contact and policy URL.

### P3 — Session cookie `Secure` / `SameSite` not directly confirmed

- HttpOnly is confirmed (see positives). `Secure` and `SameSite` could not be
  captured without a login response, which was out of scope (no credential entry).
  The site is HTTPS-only with HSTS preload, so cookies are only ever sent over TLS
  in practice, but the `SameSite` attribute should be confirmed to close CSRF
  vectors by default.
- **Remediation**: confirm the session cookie carries `Secure` and
  `SameSite=Lax` (or `Strict`). `curl -sI` a login response, or inspect in
  browser devtools → Application → Cookies.

### P3 — User-scoped endpoints return `200` + empty defaults when unauthenticated

- `/api/user/watchlist`, `/api/user/workspace-preferences`, `/api/user/risk-profile`
  and `/api/paper/positions` return `200` with `"authenticated":false` and empty
  data (`symbols:[]`, `profile:null`, `rows:[]`) rather than `401`.
- **This is not a data leak** — every body was verified to contain only anonymous
  defaults, no user records. Noted only because `401` is the conventional signal
  and returning `200` can mask genuine auth regressions from monitoring. Purely a
  hygiene observation.

### P3 — `Cross-Origin-Embedder-Policy` / `Cross-Origin-Resource-Policy` absent

- `Cross-Origin-Opener-Policy: same-origin` is set; COEP/CORP are not. Only
  relevant if the app needs cross-origin isolation (e.g. `SharedArrayBuffer`).
  Optional.

---

## Verified strengths (stated so the posture is on record)

| Area | Finding |
|---|---|
| HSTS | `max-age=63072000; includeSubDomains; preload` — 2 years, preload-eligible |
| Clickjacking | `X-Frame-Options: DENY` **and** CSP `frame-ancestors 'none'` |
| MIME sniffing | `X-Content-Type-Options: nosniff` |
| Referrer | `strict-origin-when-cross-origin` |
| Permissions-Policy | camera/mic/geolocation/payment/usb `()`, interest-cohort off |
| CSP base | `object-src 'none'`, `base-uri 'self'`, `form-action` limited to self + Stripe |
| Session cookies | **HttpOnly** — `document.cookie` is empty in an authenticated session, so XSS cannot read the session |
| Env exposure | `/.env`, `.env.local`, `.env.production`, `.env.development` all 404 |
| Source control | `/.git/HEAD` 404; `/package.json`, `/compose.yaml`, `/.DS_Store` 404 |
| Source maps | `/_next/static/chunks/*.js.map` 404 — not shipped to production |
| Server fingerprint | `server: cloudflare` (origin hidden); no `X-Powered-By` |
| Transport | HTTP → HTTPS `308`; Cloudflare edge / WAF in front |
| Auth boundary | `/api/discovery`, `/api/notifications`, `/api/admin/*`, `/api/developer/api-keys` all `401` unauthenticated |
| Info in errors | `/api/auth/me` unauthenticated returns clean `{"authenticated":false,...}`, no stack trace, no enumeration |
| Caching | `cache-control: no-store` on API, `private, no-store` on pages |

---

## What was NOT tested (so the gaps are explicit)

- **Authenticated / authorization-depth testing** (IDOR across real accounts,
  privilege escalation) — would need two real accounts and careful, possibly
  data-touching probes. Not done; the unauthenticated boundary is clean, but the
  authenticated boundary between users is unverified.
- **Injection** (SQLi, XSS sinks, SSRF, template injection) beyond confirming no
  obvious reflected surface — thorough injection testing risks data mutation and
  was out of the non-destructive scope.
- **Rate limiting / brute force** — the infra has rate limiting
  (`rate_limit_buckets`, edge WAF) but it was not stress-tested, to stay clearly
  non-destructive.
- **TLS cipher/protocol depth** — no `testssl`/`nmap` available; Cloudflare edge
  assumed current.
- **Stripe / webhook signature validation, email flows, admin surface behind auth.**

A fuller engagement would need an explicit test account (or two), a maintenance
window for the injection and rate-limit portions, and TLS tooling.

## Priorities

1. **P1** — enumerate and patch the 1 critical + 6 high npm advisories.
2. **P2** — nonce-based CSP; remove `'unsafe-inline'` from `script-src`.
3. **P3** — `security.txt`; confirm cookie `Secure`/`SameSite`; consider `401`
   over `200` on unauthenticated user endpoints.
4. Commission an authenticated, windowed test for IDOR/injection/rate-limit —
   the part a non-destructive external pass cannot cover.
