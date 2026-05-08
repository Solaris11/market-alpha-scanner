# Social Crawler Access

TradeVeto public marketing pages must be fetchable by social preview crawlers so OpenGraph previews render on Facebook, X, LinkedIn, Slack, and Discord.

## Public Preview Surface

Only these public paths are considered preview-safe:

- `/`
- `/pricing`
- `/features`
- `/how-it-works`
- `/faq`
- `/og-image.png`

App routes, account routes, premium APIs, and symbol detail routes are not part of the social crawler allowlist.

## App Guardrail

The Next.js proxy allows known social preview crawlers through only when all conditions are true:

- method is `GET` or `HEAD`
- path is one of the public preview-safe paths
- user-agent matches `facebookexternalhit`, `Facebot`, `Twitterbot`, `LinkedInBot`, `Slackbot`, or `Discordbot`

This guardrail prevents app-level middleware changes from accidentally blocking public previews while keeping private surfaces closed.

## Cloudflare Guardrail

If a social debugger reports `403` while direct crawler curl checks return `200`, the block is likely before the request reaches the app. Check Cloudflare Security Events for the request and add a scoped skip/allow rule for legitimate social crawlers only.

Recommended custom rule shape:

```text
(http.request.method in {"GET" "HEAD"}
 and http.request.uri.path in {"/" "/pricing" "/features" "/how-it-works" "/faq" "/og-image.png"}
 and (
   lower(http.user_agent) contains "facebookexternalhit"
   or lower(http.user_agent) contains "facebot"
   or lower(http.user_agent) contains "twitterbot"
   or lower(http.user_agent) contains "linkedinbot"
   or lower(http.user_agent) contains "slackbot"
   or lower(http.user_agent) contains "discordbot"
 ))
```

Use the narrowest Cloudflare action that resolves the event, usually skipping managed challenge/bot fight behavior for the matched traffic rather than disabling WAF protections globally.

## Validation

```bash
curl -I -A "facebookexternalhit/1.1" https://tradeveto.com/
curl -I -A "Facebot" https://tradeveto.com/
curl -I -A "Twitterbot/1.0" https://tradeveto.com/
curl -I -A "LinkedInBot/1.0" https://tradeveto.com/
curl -I -A "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)" https://tradeveto.com/
curl -I -A "Discordbot/2.0" https://tradeveto.com/
curl -I https://tradeveto.com/og-image.png
```

Expected result for public marketing pages and `og-image.png`: `200 OK`.
