# Phase 13.2d - Branded Production QR Code System

## Summary

TradeVeto now has a production-ready QR workflow for invite-only beta marketing assets. The QR destination is a short internal redirect route:

- QR encoded URL: `https://tradeveto.com/join`
- Current redirect target: `/register`
- Additional reserved short routes: `/beta`, `/invite`

This gives the current beta campaign a clean public URL while preserving flexibility. Future campaigns can change the server-side redirect behavior without reprinting the QR pattern, as long as the `/join` route remains the campaign entry point.

## Static vs Dynamic Decision

Recommended current approach: **static QR pointing to a controlled redirect route**.

Why:

- More reliable than third-party dynamic QR providers.
- No vendor dependency or tracking intermediary.
- Cleaner and shorter than encoding `/register` directly.
- Future-proof enough for beta because `/join` can later redirect to `/register`, `/beta`, `/invite`, or campaign-specific onboarding.

Do not use fake AI-generated QR patterns in posters. Use the committed assets below.

## Generated Assets

Repo path:

- `frontend/public/marketing/qr/`

Production URL base:

- `https://tradeveto.com/marketing/qr/`

Assets:

- `tradeveto-register-qr.png` - 2048x2048 high-resolution standard QR, safest for print and general use.
- `tradeveto-register-qr.svg` - vector QR for design tools and high-resolution layouts.
- `tradeveto-register-qr-transparent.png` - transparent-background QR for light poster/card backgrounds only.
- `tradeveto-register-qr-dark.png` - 2600x2600 dark branded QR panel for premium fintech-style posts.
- `tradeveto-register-qr-social-square.png` - 1080x1080 square asset for Instagram/Facebook/LinkedIn/X posts.
- `tradeveto-register-qr-story-overlay.png` - 1080x1920 transparent story/reel overlay.
- `qr-manifest.json` - target URL, route list, usage notes, and decoder validation results.

## Branding Approach

The branded QR assets use:

- Dark institutional background.
- Cyan/blue accent frame.
- Minimal text: `TRADEVETO`, `Scan to join`, `INVITE-ONLY BETA`.
- High-contrast QR modules on a white QR card.

The QR itself is not distorted, over-styled, or logo-obscured. Scan reliability is prioritized over decoration.

## Validation

Generation command:

```bash
cd frontend
npm run marketing:qr
```

The generator validates every generated QR with a real QR decoder. Current validation passed for:

- Standard PNG decode.
- SVG raster decode.
- Transparent PNG composited on a light background.
- Dark branded PNG decode.
- Social square PNG decode.
- Story overlay PNG decode.
- Low-brightness simulation.
- Small compressed QR simulation.
- Compressed social-media simulation.

All decoded to:

```text
https://tradeveto.com/join
```

Production route checks should verify:

- `/join` redirects to `/register`.
- `/beta` redirects to `/register`.
- `/invite` redirects to `/register`.
- `/register` renders invite-only beta messaging.
- `/marketing/qr/*` assets return `200`.

Physical iPhone/Android scans should still be repeated on the final exported poster after each social platform upload, because platform compression and crop settings can change the final image.

## Poster Replacement Notes

No committed poster source files were found in the repository for the previously generated "What Matters Now" or "Decision Assistant" posters. Replace the fake QR in those external poster files with one of these real assets:

- Use `tradeveto-register-qr-social-square.png` for square social posts.
- Use `tradeveto-register-qr-story-overlay.png` for story/reel layouts.
- Use `tradeveto-register-qr-dark.png` for standalone dark marketing blocks.
- Use `tradeveto-register-qr.png` for highest scan reliability in print or small placements.

Keep the QR at least 160px wide for digital use, preferably 240px or larger. Do not crop the quiet zone.

## Future Campaign Guidance

For new campaigns:

1. Keep `/join` as the durable public entry point unless campaign attribution requires a new route.
2. Add a new short route only when the destination needs different onboarding or attribution.
3. Regenerate assets with:

```bash
TRADEVETO_QR_TARGET_URL=https://tradeveto.com/<route> npm run marketing:qr
```

4. Run decoder validation before publishing.
5. Test the final uploaded image with iPhone and Android cameras before spending on ads.

## Status

PRODUCTION QR SYSTEM COMPLETE
