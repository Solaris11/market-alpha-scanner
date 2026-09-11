# Standing working instructions for autonomous sessions on TradeVeto

Set by the owner 2026-09-11. These are the default; they do not need to be
restated at the start of a session, and permission for anything listed under
"Default authority" does not need to be asked for again.

## Default authority — do these without asking

- **Push your own commits.** Every commit you make, you push. Do not ask.
- **Deploy to production.** For work that is going live: fetch/pull/checkout on
  production, rebuild the relevant Docker images, deploy.
- **Run smoke tests on production**, not only locally.
- **Report** browser, console, network, health, logs and restart checks.
- Build, test, typecheck, migrate (additive and rollback-able), rebuild the
  scanner-job image, run dry-run and real scans, pause and resume systemd
  timers and services, read-only production database queries, logs and health.

Do not wait for a second confirmation on any of the above, and do not defer a
deploy on the grounds that another change already shipped the same day. If the
work is verified, ship it.

## Stop, and ask, only for these

- Destructive database operations — `drop`, `truncate`, `delete`
- Mutation of real user data
- Exposing or logging a secret, token, password or environment value
- Force push
- Anything else irreversible

## Non-negotiables that stay in force

- Never touch the root `package.json`
- Never touch the user's stash
- No broad or generic relay allowlist entries — exact command patterns only,
  and validate them against the relay's own validator before use
- No live trading or order placement
- Never remove legal, risk or disclaimer copy
- Take a rollback tag **before** any image build
- No deploy without a passing build

## When a rebuild is required (owner rule, 2026-09-11)

- **Image inputs changed** (`frontend/`, `scanner/`, `investment_scanner_mvp.py`,
  `database.py`, `requirements.txt`, `Dockerfile`, `compose.yaml`) → rebuild and
  deploy are **mandatory**.
- **Only docs or host-side ops scripts changed** (`docs/`, `tools/ops/`) →
  rebuild is **not** required (it would produce a byte-identical image and
  recreate containers for nothing).
- **Either way**, prod pull, verification of the affected script/service, and a
  prod smoke test are still mandatory.
- **Every report states explicitly** whether image inputs changed.

Decide by `git diff --name-only <old>..<new>` against the image-input paths
above, and put the verdict in the report.

## The deploy shape that has worked

1. Record production HEAD, branch and current image tags
2. Take rollback tags for every image you are about to replace
3. Fetch and check out the branch on production
4. Rebuild the images
5. Recreate the containers
6. Smoke test the real routes on production
7. Verify in a browser at desktop **and** mobile width
8. Check console, network, health, logs and restart counts
9. Confirm the change is actually visible, not merely deployed
10. Report the result together with the rollback plan

Runbooks: `docs/ops/scanner-job-deploy-runbook.md` for the scanner image,
`docs/ux/terminal-ia-deploy-plan-20260911.md` for a worked frontend example.

## Non-negotiable product principle for all P2 work — WHAT → WHERE → WHICH

Every UX / algorithm / chart change is judged by whether it improves the
trader's three questions. Build decision support, not indicator decoration. Do
not add a chart visual unless it helps one of these; do not make the page
prettier at the cost of slower decisions or worse performance.

1. **WHAT — the correct decision.** Synthesize the evidence into a clear action:
   ENTER / WAIT / WAIT_PULLBACK / EXIT / AVOID, with the condition attached
   ("WAIT — buy only if price reclaims $506 with 5m/15m confirmation";
   "ENTER — breakout confirmed, stop below $492, target $528"). Never leave the
   user with raw indicators only.
2. **WHERE — the correct price levels.** The most important output is not a
   score, it is actionable levels: ideal entry / limit, entry zone,
   invalidation, stop, target 1/2/3, support/resistance, breakout/retest.
   Derived from the 1D→4H→1H→5m/15m workflow when data exists, from price
   structure + volume + EMA/VWAP + momentum + S/R. On the chart the trader must
   see *why* those levels were chosen.
3. **WHICH — ranking / capital allocation.** Single-symbol analysis is not
   enough: help decide where capital goes across candidates ("AMD 87, SNDK 81,
   MSTR 74 — AMD is the best current risk/reward"). Symbol evidence should roll
   up into opportunity ranking, and ranking should link back to chart evidence.

## Model use during long runs

Use the normal coding model for implementation, tests, deploy and smoke.
Reserve Fable for a high-level architecture/product review checkpoint before a
major decision — not for routine coding loops.

## Two habits worth keeping

**Measure instead of asserting.** "The verdict is 33 screens down" was worth
saying because it was 29,675 measured pixels. Claims about production get
checked against production.

**Report what is not verified as clearly as what is.** A build gate that did
not run, a browser check that could not happen, a preventive control that is
written but wired to nothing — each of these is more useful stated than
quietly omitted. The reader is deciding what to trust.
