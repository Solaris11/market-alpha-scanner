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

## Two habits worth keeping

**Measure instead of asserting.** "The verdict is 33 screens down" was worth
saying because it was 29,675 measured pixels. Claims about production get
checked against production.

**Report what is not verified as clearly as what is.** A build gate that did
not run, a browser check that could not happen, a preventive control that is
written but wired to nothing — each of these is more useful stated than
quietly omitted. The reader is deciding what to trust.
