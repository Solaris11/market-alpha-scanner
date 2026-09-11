# `/terminal` IA simplification — build gate, verification and deploy plan

2026-09-11 · branch `work/terminal-ia-simplification` @ `6f3a671e` (on remote)
· **not deployed**

## 1. Build gate — PASSED

`next build` cannot run on the bridge (the repo's `node_modules` is a macOS
install, the VM is Linux) and cannot run in the cloud container (npm registry
returns 403). The frontend Dockerfile's builder stage *is* the build gate, so
it was run on production — **as a build only**.

```
git worktree add  /opt/apps/market-alpha-scanner/app/uxbuild 6f3a671e
docker build -t tradeveto-frontend:uxcandidate \
  -f /opt/apps/market-alpha-scanner/app/uxbuild/frontend/Dockerfile \
     /opt/apps/market-alpha-scanner/app/uxbuild
git worktree remove --force /opt/apps/market-alpha-scanner/app/uxbuild
```

Result:

```
✓ Compiled successfully in 10.1s
✓ Generating static pages using 19 workers (22/22) in 311ms
naming to docker.io/library/tradeveto-frontend:uxcandidate  done
exit=0
```

Image: `sha256:6560253ecd15…`, built 2026-09-11T06:51:28Z.

**Nothing was deployed and nothing could have been.** The relay patterns added
for this reject building over `:latest`, `docker compose up`, moving the
production checkout, and creating a worktree at the app path — all verified
against the validator before use. Production's checkout was `80197b38` before
the build and `80197b38` after it; the worktree is removed; no container was
created, recreated or restarted; `tradeveto-frontend:uxcandidate` is a tag no
compose service or running container refers to.

### One finding from the build, not caused by this branch

`npm ci` reported **17 vulnerabilities (1 low, 9 moderate, 6 high, 1 critical)**
in the existing dependency tree. This branch never touched
`frontend/package.json` or the lockfile, so the finding is pre-existing and
would appear on any build today. It is not a build failure and it does not
block this deploy, but a critical advisory in the dependency tree deserves its
own pass.

## 2. Verification status — and what I deliberately did not do

| Gate | Status |
|---|---|
| Typecheck (`tsc --noEmit`) | **clean** |
| Unit tests | **672 passing**, 0 failing (660 before this branch) |
| `next build` | **passed**, above |
| No component lost | **verified** — JSX element multiset diffed against HEAD; nothing lost, only the two `TerminalSection` wrappers added (47 → 48) |
| Legal / risk copy intact | **verified** — identical string counts in the edited file |
| Desktop browser | **not done** — needs the code running |
| Mobile browser | **not done** — needs the code running |
| Console / network clean | **not done** — needs the code running |
| Performance regression | **not measurable yet** — see below |

The last four cannot be done without running this build somewhere. The two ways
to do that are:

1. **A second frontend container on production, on an unrouted port.** Rejected
   for now. It would need the real `.env`, so it would connect to the
   production database as a full application instance and could write telemetry
   (`analytics_events`, `request_metrics`, sessions). That conflicts with "no
   mutation of real user data", and I am not willing to interpret my way around
   that constraint for a convenience.
2. **Verify inside the deploy window, with rollback armed.** This is the
   recommendation. The procedure in §4 makes the verification the gate: if any
   check fails, the rollback is one `docker tag` and a recreate.

I would rather say these four are unverified than run something that blurs the
data boundary.

## 3. Performance: an honest read

**This change does not reduce the page's payload or its server render time, and
I should not let the scroll numbers imply that it does.**

`<details>` still mounts its children when closed. The two `TerminalSection`
groups change what the browser lays out and paints, and what the trader has to
scroll past — they do not change what the server renders or what crosses the
wire. `TerminalPremiumView` still runs the same 13 awaited fetches and ~22
model builds, and the RSC payload is the same size.

What the branch should improve:

- **Layout and paint work on first render** — roughly 15,857 px of measured
  panel height (retention + continuity + proof) plus the deep-research group
  starts collapsed.
- **Time to the decision** — `DailyActionCard` moves from 29,675 px (33 screens)
  down the page to the first screen. This is the actual point of the change.

What it costs:

- Two extra O(n) passes over `snapshot.signals` (n ≈ 353) for the command-bar
  counts and the triage buckets, plus a sort of at most three short lists. Both
  are server-side and negligible next to the existing model construction.

What would actually reduce payload and server time — `next/dynamic` on the
heavy panels, or moving the collapsed groups behind Suspense so they stream —
is **not** in this branch and is the honest next step if payload is the goal.

## 4. Deploy procedure, with rollback armed before the first change

### 4.1 Rollback tag first

```bash
cd /opt/apps/market-alpha-scanner/app
docker tag market-alpha-scanner-market-alpha-frontend:latest \
          market-alpha-scanner-market-alpha-frontend:rollback-YYYYMMDDa
docker tag market-alpha-scanner-market-alpha-frontend-hot-api:latest \
          market-alpha-scanner-market-alpha-frontend-hot-api:rollback-YYYYMMDDa
```

Both, because the two services share the `&frontend-service` anchor and are
built from the same Dockerfile.

### 4.2 Move the checkout, then build through compose

The candidate image proves the code compiles; the deploy still builds through
compose so the images carry the normal tags and the two services stay in step.

```bash
git fetch origin work/terminal-ia-simplification
git checkout work/terminal-ia-simplification    # prod checkout moves here
docker compose --env-file .env -f compose.yaml build \
  market-alpha-frontend market-alpha-frontend-hot-api
```

### 4.3 Recreate, then verify before walking away

```bash
docker compose --env-file .env -f compose.yaml up -d \
  market-alpha-frontend market-alpha-frontend-hot-api
docker compose ps        # both healthy, restarts=0
curl -s https://tradeveto.com/api/health
```

Then, in a signed-in browser:

- `/terminal` renders; the command bar is the first element and shows regime,
  scan freshness, ENTER / WATCH / WAIT counts and alert count
- `DailyActionCard` is on the first screen
- both `TerminalSection` groups are present and **open on click**, and every
  panel that moved into them is reachable
- the four ranked-opportunity surfaces still render their rows
- console: no errors
- network: no 4xx/5xx
- re-measure `document.documentElement.scrollHeight` at 1425×900 and 428×714
  against the recorded baseline (71,958 px / 153,241 px)
- mobile width: no horizontal overflow, no overlap
- `prefers-reduced-motion: reduce`: the chevron does not animate

### 4.4 Rollback

```bash
docker tag market-alpha-scanner-market-alpha-frontend:rollback-YYYYMMDDa \
          market-alpha-scanner-market-alpha-frontend:latest
docker tag market-alpha-scanner-market-alpha-frontend-hot-api:rollback-YYYYMMDDa \
          market-alpha-scanner-market-alpha-frontend-hot-api:latest
docker compose --env-file .env -f compose.yaml up -d \
  market-alpha-frontend market-alpha-frontend-hot-api
git checkout release/success-rate-units          # restore the checkout too
```

Frontend containers are stateless; nothing needs unwinding. Recovery is one
minute.

## 5. Risk assessment

| Risk | Severity | Mitigation |
|---|---|---|
| A moved panel breaks because it depended on render order | low | Nothing was retyped — each panel's JSX was extracted verbatim and reinserted; the element multiset is diffed against HEAD |
| A collapsed panel's client effects behave differently while closed | **medium** | `<details>` mounts children regardless, so effects run as before — but this is the one thing only a browser can confirm, and it is explicitly in §4.3 |
| Scroll-position or deep-link behaviour changes | low | No routing or anchor change; `<details>` keeps content findable by in-page search |
| The 33-screen reorder disorients an existing user | low–medium | Nothing removed, order within each group preserved; worth a note to beta users |
| Deploying the day after a three-month scanner jump | **medium** | This is the real one. The scanner change is verified through a full `--run-analysis` scan, but two significant production changes in ~24h share a blast radius. Recommend a separate window |
| Pre-existing dependency vulnerabilities | medium | Unrelated to this branch; own pass |

## 6. Recommendation

The build gate is green and the code is verified as far as it can be without
running it. I would **not** deploy this on the same day as the scanner image
jump. A separate window, with §4 followed in order and the browser checks
treated as the gate rather than a formality, is the right shape — and it is the
owner's call, not mine.
