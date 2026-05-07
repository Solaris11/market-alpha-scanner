# Closed Beta Launch Checklist

Use this checklist before inviting each beta cohort.

## Domain / Routing

- [ ] `https://tradeveto.com` returns 200.
- [ ] `https://www.tradeveto.com` redirects to apex.
- [ ] Legacy Market Alpha domains 301 to TradeVeto without path/query loss.
- [ ] SSL certificate is valid.
- [ ] Cloudflare tunnel is healthy.

## Auth / Access

- [ ] Registration works for selected beta access mode.
- [ ] Existing users can sign in.
- [ ] Email verification sends and links work.
- [ ] Onboarding profile gate works.
- [ ] Legal/risk acknowledgement gate works.
- [ ] Admin routes remain admin-only.

## Billing

- [ ] Live Stripe keys are configured.
- [ ] Checkout creates a live Stripe session.
- [ ] Optional trial period appears correctly when enabled.
- [ ] Optional promo-code field appears when enabled.
- [ ] Account page explains trial/renewal/cancellation clearly.
- [ ] Billing portal opens for Stripe-linked users.
- [ ] Webhook bad signatures fail.
- [ ] Duplicate webhook events are idempotent.
- [ ] Trialing, active, canceled-at-period-end, expired, and past-due states render correctly.

## Product QA

- [ ] Terminal loads on desktop/mobile.
- [ ] Opportunities loads on desktop/mobile.
- [ ] Symbol detail loads for NVDA and OXY.
- [ ] History filters and tooltips work.
- [ ] Alerts and watchlists work for premium users.
- [ ] Support chat blocks financial advice.
- [ ] Support ticket creation and admin reply emails send.
- [ ] Beta feedback widget submits successfully.

## Analytics

- [ ] Page view event writes.
- [ ] Feedback event writes.
- [ ] `/admin/analytics` is admin-only.
- [ ] Visitor Insights charts load for admin.
- [ ] No secrets or raw IPs are stored.

## Monitoring / Backup

- [ ] `/api/health` OK.
- [ ] `/api/health/deep` OK.
- [ ] `npm run monitoring:synthetics` succeeds.
- [ ] `npm run monitoring:system` succeeds.
- [ ] Post-deploy R2 backup succeeds.
- [ ] Deep health shows local/offsite/overall backup status honestly.

## Support / Email

- [ ] SPF includes Google Workspace.
- [ ] DKIM is enabled.
- [ ] DMARC exists.
- [ ] MX routes to Google Workspace.
- [ ] `support@tradeveto.com` receives internal support notifications.
- [ ] `billing@tradeveto.com` is available for billing replies.
- [ ] `noreply@tradeveto.com` sends account/system mail.

## Rollback

- [ ] Previous git commit is known.
- [ ] Docker image can be rebuilt from previous commit.
- [ ] Database migrations are additive only.
- [ ] R2 backup exists before deploy.
- [ ] Cloudflare tunnel/DNS rollback notes are available.
