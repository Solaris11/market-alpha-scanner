# Production deploy record — 2026-09-04

## What is live

| | |
|---|---|
| **Prod HEAD** | `1c6089cb` — *Compute terminal actionability on the server* |
| Previous HEAD | `b177dea8` |
| Deployed at | 2026-09-04 13:07 UTC |
| **Prod checkout branch** | **`release/actionability-fix`, not `origin/main`** — see below |
| Rollback image tag | `rollback-20260904a` (frontend `ee979bbb6d73`, hot-api `45fc8fd8e808`) |
| Containers | both healthy, `restarts=0`, 15 min uptime at verification |

### Why the checkout is off `origin/main`, and why that is safe

`main` could not be advanced. The git proxy refused a push credential for this
repository on every attempt — *"not in this session's authorized repository
set"* — so the owner's instruction was to deploy from the exact remote branch
instead, and to say so plainly here.

Prod ran `git pull --ff-only origin release/actionability-fix`, which
fast-forwarded `b177dea8 → 1c6089cb`. `release/actionability-fix` is `main`
plus one cherry-pick, so:

- it was a genuine fast-forward, not a reset;
- `origin/main` (`b177dea8`) is now an **ancestor** of prod HEAD, so the
  documented `git pull --ff-only origin main` still succeeds — it is simply a
  no-op until `origin/main` advances past `1c6089cb`;
- once `main` is pushed forward, the normal deploy path resumes with no
  cleanup.

Two literal branch names were added to the relay's deploy allowlist —
`git fetch origin release/actionability-fix` and
`git pull --ff-only origin release/actionability-fix`. Literal names, not a
pattern that would accept any branch.

## Gates

| Gate | Result |
|---|---|
| `tsc --noEmit` | clean |
| Full suite, 150 test files | all pass |
| **`next build`** | **passed — inside the image build on the host**: `✓ Compiled successfully in 10.7s`, `docker compose build` exit 0 |
| Cherry-pick onto `main` | clean, verified before deploying |

The image build is the real build gate and it runs `npm ci` + `next build` on
Linux, which is exactly the check that could not run anywhere else in this
session.

## Post-deploy verification

| Check | Result |
|---|---|
| Prod HEAD is the expected commit | `1c6089c` |
| Containers healthy | both, `restarts=0` |
| `/api/health` | 200, process block present |
| Logs | clean; `[render-timing] route=/terminal total=1300ms steps=41 signals=355`, no errors |
| Console / network | no errors, no 4xx/5xx |
| Signed-in check (`perf-test@tradeveto.com`) | `/terminal` renders, premium entitlement resolved |
| Provider / debug fields in payload | **0** for all six keys |
| Server actionability map present | **355 entries** carrying all five fields |

## The result that changed the diagnosis

**The deploy changed nothing a reader can see.** The five shock cards on
`/terminal` render exactly as before: one distinct action line, and *0%*
historical chase success on every symbol.

That is not a failed deploy — the change did precisely what it was designed to
do, and the server-computed map is in the payload. It means the visible symptom
had a different cause, and the deploy is what proved it.

The cause is a unit bug. `chaseSuccessRate` and `pullbackSuccessRate` are
fractions — `rate()` returns `matched / total`, shock-move's own
`chaseRiskControl` already writes `chaseSuccessRate * 100`, and on production
all 1,134 rows of `shock_move_patterns` hold `chase_success_rate` in 0–1 and
`pullback_success_rate` in 0–0.6. Four sites in `execution-intelligence.ts`
read them as percentages:

- `Math.round(0.2667)` is `0`, so every card printed **0%** against a real
  24–58%;
- the guard `chaseSuccessRate < 45` is true for *every possible fraction*, so
  that warning fired on every symbol unconditionally — which is why all five
  cards were identical;
- `pullbackQuality` weighted the fraction `0.20` against five terms on 0–100,
  costing roughly six points wherever a pattern exists. A scoring error, not a
  display one.

Fixed in `80197b38` (on `release/success-rate-units`) and `3b01d117` (on
`work/autonomous-after-b177`). **Neither can reach production**, for the same
push reason.

## A claim of mine that this corrects

I reported the actionability regression as *three of five strings changing on
any symbol with real shock history*. That was one synthetic fixture's
behaviour, not a general law.

Fixing the unit bug moved `pullbackQuality` by about six points, that fixture
stopped straddling the threshold it had been sitting on, and the test asserting
the difference failed — correctly. Swept properly, the divergence appears in
**8 of 144** fixtures, all needing the event list at its 80-event cap plus a
BREAKOUT/MOMENTUM/CONTINUATION setup; the test file's own heavy fixture exposes
it in **none** of 60 combinations.

So `1c6089cb` is correct, is worth having, and is what makes Stage 3 safe — but
it was **not** the repair for what users were looking at. The tests now assert
the narrow truth instead of the broad one.

## Rollback

Not needed — the deploy is healthy — but if it becomes necessary:

```bash
cd /opt/apps/market-alpha-scanner/app
docker tag market-alpha-scanner-market-alpha-frontend:rollback-20260904a market-alpha-scanner-market-alpha-frontend:latest
docker tag market-alpha-scanner-market-alpha-frontend-hot-api:rollback-20260904a market-alpha-scanner-market-alpha-frontend-hot-api:latest
docker compose --env-file .env up -d --no-build market-alpha-frontend market-alpha-frontend-hot-api
docker compose ps
```

To also move the checkout back:

```bash
git -C /opt/apps/market-alpha-scanner/app checkout b177dea8 -- .
```

The running image is what serves, so the image retag alone restores behaviour.

## What is waiting on one push

| Branch | Tip | Carries |
|---|---|---|
| `release/success-rate-units` | `80197b38` | prod HEAD + the unit fix. Minimal next deploy. |
| `work/autonomous-after-b177` | `3b01d117` | the unit fix, Stage 3 + its evidence repair, watchlist dedupe, cache bound, health instrumentation, observer metrics, docs |
| `work/ux-polish` | `eb4cfeac` | chart axes/legends/empty states, reduced-motion fix, mobile header |

`release/success-rate-units` is the one to ship next: it is prod HEAD plus a
single commit, and it is the change that puts real numbers on the cards.

---

# Second deploy — 2026-09-05 23:36 UTC

| | |
|---|---|
| **Prod HEAD** | `80197b38` — *Fix the success rates that made every card read 0%* |
| Previous HEAD | `1c6089cb` |
| Prod checkout branch | `release/success-rate-units` (still not `origin/main`; `origin/main` remains an ancestor, so the documented pull stays a safe no-op) |
| Rollback tag | `rollback-20260905a` → frontend `7858b178020d`, hot-api `7b076582c365` |
| Build gate | **passed** — `✓ Compiled successfully in 10.0s`, `docker compose build` exit 0 |

## Verification

| Check | Result |
|---|---|
| Prod HEAD | `80197b38` |
| Containers | both healthy, `restarts=0` |
| Logs | clean — `✓ Ready in 131ms`, no errors |
| `/api/health` | **200** |
| Console errors | none |
| Network 4xx/5xx | none |
| `/terminal` as `perf-test@tradeveto.com` | opens, premium entitlement resolved |
| Provider/debug leakage | **0** across all six keys |
| **Chase success percentages** | **21%, 32%, 38%, 41%, 43%** — five distinct real values |
| Historical context lines | "worked 29–56% of the time", "pullback entries 11–30%" |
| Actionability confirmation language | preserved — still "Early; needs confirmation", no regression |

Before this deploy every card read **0%** and the risk warning fired on every
symbol unconditionally, because a 0–1 fraction was being rounded as a
percentage and compared against a threshold of 45. The numbers on the terminal
are now the numbers in the database.

## Rollback

```bash
cd /opt/apps/market-alpha-scanner/app
docker tag market-alpha-scanner-market-alpha-frontend:rollback-20260905a market-alpha-scanner-market-alpha-frontend:latest
docker tag market-alpha-scanner-market-alpha-frontend-hot-api:rollback-20260905a market-alpha-scanner-market-alpha-frontend-hot-api:latest
docker compose --env-file .env up -d --no-build market-alpha-frontend market-alpha-frontend-hot-api
```

## What this deploy also exposes

All five cards still read "Watch only: Early; needs confirmation". That is not
a defect in this change — it is the scanner's actual decision — and it is
exactly the complaint that opens the next piece of work: too much WAIT/WATCH,
not enough evidenced ENTER at the right time.
