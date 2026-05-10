# Phase 13 Sub-90 To 95 Improvement Plan

Date: 2026-05-10

## Purpose

Phase 13 should convert controlled-beta readiness into real-world product confidence. The goal is not feature expansion. The goal is to raise the weakest readiness areas through user evidence, workflow simplification, retention proof, and scale discipline.

## Priority Order

1. User friendliness and onboarding.
2. Product clarity and opportunity comprehension.
3. Mobile real-device usability.
4. Retention instrumentation and cohort learning.
5. Strategy Labs trust education.
6. Scalability thresholds and operational capacity planning.
7. Public marketing and broad-scale readiness only after cohort proof.

## Sub-90 Upgrade Plans

| Category | Current | Why Below 90/95 | Missing Proof Or Capability | Smallest Near-Term Fix | Bigger Phase 13 Fix | Owner | Priority | Expected After Fix | Validation |
| --- | ---: | --- | --- | --- | --- | --- | --- | ---: | --- |
| User Friendliness | 86 | The product is powerful but still dense for first-time users. Users may not know where to start or how to interpret WAIT/risk language. | Real first-session evidence, confusion taxonomy, first useful action rate. | Run 5-user onboarding study; record where users pause; add a visible "Start here" CTA to the main console if users hesitate. | Build a guided first opportunity review that walks through one symbol, one risk, one watch condition, and one next action. | UX/Product/Support | P1 | 92 | 5 users complete onboarding; 80% reach first useful action within 5 minutes; fewer than 2 repeated confusion points. |
| Onboarding Quality | 86 | Onboarding exists but has not been proven with unaided users. Advanced concepts can appear too early. | Completion rate, drop-off point, beginner-vs-advanced path proof. | Add an operator checklist for every first cohort user: signup, profile, first console view, first symbol view, watchlist. | Progressive onboarding with beginner and advanced paths, shorter concept explanations, and contextual prompts after first login. | UX/Product/Support | P1 | 92 | 80% onboarding completion; 70% watchlist or symbol analysis within first session; support tickets tagged by onboarding step. |
| Mobile UX | 86 | PWA routes and assets work, but real iPhone/Android ergonomics are not proven. Dense intelligence panels can still feel heavy. | Real-device screenshots, touch target QA, mobile first useful action, push/install proof. | Test 3 real devices: iPhone, Android, tablet. Record overflow, tap difficulty, and route timing. | Mobile-first console mode: compact What Matters Now, top opportunities, watchlist, alerts, symbol detail. Hide advanced panels by default. | UX/Mobile/Product | P1 | 91 | No horizontal overflow; core routes under budget; 3 users complete mobile first useful action without guidance. |
| Product Clarity | 87 | Many intelligence layers are now unified, but labels like WAIT, Risk Review, Watch Only, asymmetry, and fragility still require trust-building. | Evidence that users understand state labels and know what to monitor next. | Add concise glossary/tooltips for WAIT, Risk Review, Watch Only, fragility, asymmetry, chase risk. | Rename or simplify repeated states based on cohort feedback; remove duplicate cards that explain the same concern. | Product/UX/AI | P1 | 93 | 5-user comprehension test: users can explain why one opportunity is interesting and why one is risky. |
| Strategy Labs | 88 | Strategy Labs is differentiated but advanced. It may feel abstract or too institutional for new users. | Beginner comprehension, proof that users understand simulation vs advice, replayable examples. | Add a short "simulation only" explanation and a simple mode summary: performance, drawdown, why entries/exits happened. | Add replayable simulated trade examples tied to real historical TradeVeto states and a plain-language strategy glossary. | Product/AI/UX | P2 | 92 | Users can identify that Strategy Labs is simulated research; zero confusion with real-money execution in support feedback. |
| Scalability | 84 | Current Linux deployment is healthy for 25 users, but broad public scale needs queue/cache/cloud thresholds. | Real concurrent traffic, DB/query pressure, OpenAI cost behavior, support load at cohort size. | Keep 25-user cap; add daily DB connection/query timing and OpenAI cost review to beta checklist. | Define and test thresholds for Redis queue, worker separation, managed Postgres/RDS, ECS/Fargate migration, and CDN/static asset policy. | Infra/Ops | P1 | 90 | 25-user cohort with no repeated route budget misses, no DB exhaustion, and daily cost within budget. |
| Retention Readiness | 84 | Habit loops exist conceptually, but DAU/WAU and revisit behavior are not proven by real users. | Cohort DAU/WAU, watchlist creation, revisit rate, alert engagement, "what changed" usage. | Track first useful action, watchlist creation, 24h revisit, 7-day revisit, and daily briefing engagement for each beta user. | Build a retention review dashboard with cohort funnels: onboarding, watchlist, symbol revisit, what-changed, copilot, replay, Strategy Labs. | Product/Analytics/Support | P1 | 91 | 60% 24h revisit for first 5 users; 40% 7-day revisit after first cohort week; at least 70% create watchlist or view repeat symbol. |
| Public Marketing Push Readiness | 78 | Product is not ready for broad top-of-funnel traffic until first-cohort confusion and support load are measured. | Real testimonials, support burden, conversion clarity, trust objections, public page comprehension. | Keep public marketing limited to invite-only/demo traffic; avoid broad campaigns until first cohort review. | Publish only proven pages: strategy performance, replay studies, risk disclosure, and "why wait" pages with real evidence and support readiness. | Growth/Product/Support | P2 | 88 | First cohort feedback identifies no major trust/confusion blockers; email/social previews stable; support response SLA holds. |
| Broad Public Scale Readiness | 72 | Controlled beta ops are green, but broad traffic needs cloud/queue/cost/support proof. | Load data, support capacity, abuse patterns, cloud migration dry run, payment/support scale readiness. | Do not open broad public signup; keep invite cap. Define user thresholds for Redis/RDS/ECS and support staffing. | Run phased scale plan: 25 users, 50 waitlist users, 100 controlled users, then cloud migration decision with measured bottlenecks. | Infra/Ops/Support/Growth | P0 for broad launch, P2 for beta | 85 | No broad-launch GO until cohort stability, cost budget, support SLA, abuse monitoring, and migration plan are proven. |

## Phase 13 Execution Plan

### Week 1: First Cohort Learning

- Invite 5 external users.
- Track onboarding completion, first useful action, first watchlist, first symbol revisit, first support request.
- Run daily support/confusion review.
- Do not expand if more than 2 users hit the same confusion point.

### Week 2: UX And Retention Fixes

- Patch the top 3 confusion points only.
- Simplify labels and cards based on real language users use.
- Add/adjust Start Here prompts if first useful action is slow.
- Improve mobile only where real device feedback shows friction.

### Week 3: Expand Carefully

- Expand to 10 users only if Week 1/2 support load is controlled.
- Begin measuring 7-day revisit behavior.
- Review OpenAI cost and route performance daily.

### Week 4: Decide Next Gate

- Expand toward 25 only if support, retention, billing, and ops stay green.
- Re-score sub-90 categories with real evidence.
- Decide whether public marketing remains blocked, moves to limited waitlist, or starts with proof-oriented pages only.

## Non-Negotiables

- No broad public signup until cohort data exists.
- No new feature explosion in Phase 13.
- No marketing claims beyond proven evidence.
- Keep research-only and non-advisory language.
- Keep daily ops checks during every invite wave.
