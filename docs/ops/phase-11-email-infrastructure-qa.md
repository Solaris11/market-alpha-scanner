# Phase 11.4 Email, DNS, Inbox Placement + Notification QA

This runbook verifies that TradeVeto email infrastructure is safe enough for controlled launch.

Automated DNS and route checks can prove domain configuration. Inbox placement still requires real
canary messages and mailbox/header inspection.

## Automated DNS + Route Check

Run from any operator machine:

```bash
tools/ops/tradeveto-email-infrastructure-check.sh
```

The script checks:

- Google Workspace MX records
- SPF record with `_spf.google.com`
- DKIM at `google._domainkey.tradeveto.com`
- DMARC record
- `/api/health`, `/api/health/deep`, `/support/contact`, and `/reset-password`
- SMTP STARTTLS reachability to `smtp.gmail.com:587`
- response bodies for common secret patterns

Current expected caveats:

- SPF currently uses `~all`, which is acceptable during controlled beta but should move to `-all`
  after sender inventory is complete.
- DMARC currently uses `p=none`, which is acceptable for monitoring but should move to
  `p=quarantine` and then `p=reject` after inbox-placement proof is stable.

## Live Canary Sends

Run on the production host with SMTP env loaded:

```bash
cd /opt/apps/market-alpha-scanner/app
set -a
source .env
set +a

TRADEVETO_EMAIL_QA_SEND_TO=<qa-inbox@example.com> \
  tools/ops/tradeveto-email-infrastructure-check.sh
```

Or send individual canaries:

```bash
cd /opt/apps/market-alpha-scanner/app/frontend
npm run email:test -- --to <qa-inbox@example.com> --category system
npm run email:test -- --to <qa-inbox@example.com> --category verification
npm run email:test -- --to <qa-inbox@example.com> --category password_reset
npm run email:test -- --to <qa-inbox@example.com> --category support
npm run email:test -- --to <qa-inbox@example.com> --category billing
npm run email:test -- --to <qa-inbox@example.com> --category strategy
npm run email:test -- --to <qa-inbox@example.com> --category replay
npm run email:test -- --to <qa-inbox@example.com> --category onboarding
```

## Inbox Placement Checklist

For Gmail and Outlook, inspect each received message:

- delivered to inbox, not spam/promotions if avoidable
- `SPF: PASS`
- `DKIM: PASS`
- `DMARC: PASS`
- From domain aligns with `tradeveto.com`
- links point only to `tradeveto.com`
- no old Market Alpha branding
- support mail replies route to `support@tradeveto.com`
- billing mail replies route to `billing@tradeveto.com`
- system mail uses `TradeVeto <noreply@tradeveto.com>`

## Alias Checklist

Verify in Google Workspace:

- `noreply@tradeveto.com` exists as a verified send-as identity or alias
- `support@tradeveto.com` receives contact/support replies
- `billing@tradeveto.com` receives billing replies
- support routing forwards or delegates to the operating support inbox
- billing routing forwards or delegates to the billing owner inbox

## Launch Gate

Use final status `EMAIL INFRASTRUCTURE VERIFIED` only when:

- DNS script passes
- category canary sends succeed from production
- Gmail inbox placement is verified
- Outlook inbox placement is verified or explicitly accepted as deferred
- received headers show SPF, DKIM, and DMARC pass
- aliases route replies correctly
- no stale sender/domain/Market Alpha branding appears
- email failure events are visible in monitoring

If canary sends or inbox placement have not been inspected, use:

```text
EMAIL DELIVERY STILL RISKY
```
