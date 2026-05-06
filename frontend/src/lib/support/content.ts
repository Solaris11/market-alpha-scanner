export const SUPPORT_DISCLAIMER = "Market Alpha Scanner is for research and education only. It does not provide financial advice.";

export type SupportFaqItem = {
  answer: string;
  question: string;
  slug: string;
};

export type SupportGuide = {
  body: string[];
  slug: string;
  title: string;
};

export const SUPPORT_FAQ: SupportFaqItem[] = [
  {
    slug: "what-is-market-alpha",
    question: "What is Market Alpha Scanner?",
    answer: "Market Alpha Scanner is an AI-powered trading research platform that helps organize market conditions, scanner signals, risk context, and decision support into one workflow.",
  },
  {
    slug: "financial-advice",
    question: "Is this financial advice?",
    answer: "No. Market Alpha Scanner is for research and education only. It does not provide financial advice, investment recommendations, or guaranteed outcomes.",
  },
  {
    slug: "wait",
    question: "What does WAIT mean?",
    answer: "WAIT means the system does not see conditions that justify an active research setup. The product is intentionally prioritizing patience until conditions improve.",
  },
  {
    slug: "watch",
    question: "What does WATCH mean?",
    answer: "WATCH means a setup may be forming, but it is not yet a complete research signal. It belongs on a review list, not in an execution workflow.",
  },
  {
    slug: "buy",
    question: "What does Research Setup mean?",
    answer: "Research Setup is a scanner label for a complete research condition. It is not an instruction to buy and it is not personalized financial advice.",
  },
  {
    slug: "avoid",
    question: "What does AVOID mean?",
    answer: "AVOID means risk, setup quality, data freshness, or market context does not meet the product's research criteria.",
  },
  {
    slug: "scanner-work",
    question: "How does the scanner work?",
    answer: "The scanner evaluates trend, momentum, volatility, market regime, risk/reward, and related signal data, then presents a decision-support summary.",
  },
  {
    slug: "data-updated",
    question: "How often is data updated?",
    answer: "Scanner freshness is shown inside the app. If data is stale, action recommendations are suppressed until a fresh scan is available.",
  },
  {
    slug: "premium",
    question: "What is Premium?",
    answer: "Premium unlocks full research views, ranked setups, alerts, paper trading workflows, and deeper scanner intelligence. It does not provide financial advice.",
  },
  {
    slug: "cancel-renew",
    question: "How do I cancel or renew subscription?",
    answer: "Open Account, then Manage Subscription. Stripe handles cancellation, renewal, and billing changes.",
  },
  {
    slug: "alerts",
    question: "How do alerts work?",
    answer: "Premium alert rules are saved to your account and evaluated against scanner research data. Alerts are research notifications, not trading instructions.",
  },
  {
    slug: "paper-trading",
    question: "How does paper trading work?",
    answer: "Paper trading lets you model research ideas without live execution. It is educational and does not connect to a broker.",
  },
  {
    slug: "limited-data",
    question: "Why do I see limited data as a free user?",
    answer: "Free accounts receive public preview data only. Full scanner details, trade-plan fields, and premium analytics require Premium.",
  },
  {
    slug: "no-trade-today",
    question: "Why can the scanner say No trade today?",
    answer: "The product is designed to reduce overtrading. If conditions do not justify action, the system intentionally shows a no-trade decision.",
  },
  {
    slug: "data-provider",
    question: "What data provider is used?",
    answer: "Market Alpha Scanner uses market data ingested by the scanner pipeline. Provider availability and freshness can vary, so the app displays data freshness indicators.",
  },
  {
    slug: "wrong-stale-data",
    question: "What if I see wrong or stale data?",
    answer: "Do not act on stale or suspicious data. Refresh later and open a support ticket with the symbol, page, and time you saw the issue.",
  },
];

export const SUPPORT_GUIDES: SupportGuide[] = [
  {
    slug: "read-terminal",
    title: "How to read the terminal",
    body: [
      "Start with Market State and Daily Action. That is the decision hierarchy.",
      "If the action is WAIT or stale, trade UI is intentionally disabled.",
      "Use setup cards for research context only; they are not personalized recommendations.",
    ],
  },
  {
    slug: "open-ticket",
    title: "How to open a support ticket",
    body: [
      "Open Support, then Tickets.",
      "Choose the closest category and describe what happened.",
      "Include page, browser, approximate time, and any safe screenshots. Do not paste secrets or passwords.",
    ],
  },
  {
    slug: "billing",
    title: "Billing and subscription help",
    body: [
      "Open Account and use Manage Subscription for Stripe-hosted billing.",
      "Cancellation at period end keeps access active until the paid-through date.",
      "If the app and Stripe disagree, open a billing ticket.",
    ],
  },
  {
    slug: "alerts",
    title: "Using alerts safely",
    body: [
      "Alerts notify you when research conditions match your saved rules.",
      "Alerts are not trade instructions.",
      "Disable noisy or stale alert rules and review scanner freshness before acting.",
    ],
  },
];

export function findSupportAnswer(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("refresh failed") || normalized.includes("analysis refresh failed") || normalized.includes("signals failed")) {
    return [
      "Refresh controls are coordinated by a single scanner lock.",
      "If you see a running state, another scanner or analysis job is already active. The correct behavior is to wait for that run to finish; the latest run time will update automatically.",
      "If the page remains stale after the next scheduled run, open a technical ticket with the page, timestamp, and symbol if one was involved.",
    ].join("\n");
  }
  if (normalized.includes("scanner running") || normalized.includes("already running")) {
    return [
      "Only one scanner run can execute at a time.",
      "The app disables duplicate refreshes to prevent corrupted partial output. Data updates when the active run completes.",
      "You can keep using the latest completed scan while the new run is in progress.",
    ].join("\n");
  }
  if (normalized.includes("no buy") || normalized.includes("no active trade") || normalized.includes("no trade") || normalized.includes("no research setup")) {
    return [
      "No active research setup can be a healthy result.",
      "Market Alpha is built around the idea that the best trade is often no trade. Wait, Watch, and Avoid mean the scanner is prioritizing risk control, data quality, and setup confirmation over forced activity.",
      "Review the Decision Reasons and What To Watch panels to see which conditions would need to improve.",
    ].join("\n");
  }
  if (normalized.includes("stale data") || normalized.includes("outdated data")) {
    return [
      "Stale data reduces confidence and can disable active decision states.",
      "Use the freshness indicators first. If freshness is degraded, treat the view as historical context until the next successful scanner run.",
      "If stale status persists across scheduled runs, open a technical ticket with the symbol and page.",
    ].join("\n");
  }
  if (normalized.includes("readiness")) {
    return [
      "Readiness is a product signal that combines confidence, data quality, setup strength, and veto status.",
      "A high score can still have lower readiness if the setup is extended, data quality is weak, or a risk veto is active.",
      "Use readiness to understand how close a setup is to cleaner research conditions. It is not a prediction.",
    ].join("\n");
  }
  if (normalized.includes("confidence")) {
    return [
      "Confidence reflects signal strength and data quality inside the scanner.",
      "Low confidence usually means the scanner needs stronger confirmation or cleaner data. Medium confidence is a monitoring state. High confidence means the evidence is stronger, but it still is not a forecast.",
      "The confidence donut and readiness bar should be read together.",
    ].join("\n");
  }
  if (normalized.includes("veto")) {
    return [
      "A veto is a hard risk or quality block.",
      "Examples include stale data, weak data confidence, overextended entry context, poor risk/reward, or market-regime mismatch.",
      "When a veto is active, the UI should not present the setup as trade-ready. Use What To Watch to see the conditions that would need to improve.",
    ].join("\n");
  }
  if (normalized.includes("regime")) {
    return [
      "Market regime is the scanner's broad risk context.",
      "In overheated, risk-off, or bear conditions, the scanner raises standards and reduces breakout-style urgency. In neutral or bull conditions, it can be less restrictive, but veto and confidence gates still apply.",
      "Regime impact explains why the same symbol may receive a different decision under different market conditions.",
    ].join("\n");
  }
  if (normalized.includes("calibration")) {
    return [
      "Calibration shows what the scanner is learning from completed forward-return observations.",
      "Simple View translates this into plain English. Advanced View keeps the raw grouped metrics for deeper review.",
      "Low evidence means the system needs more historical observations before the pattern should be trusted.",
    ].join("\n");
  }
  if (normalized.includes("history") || normalized.includes("filter") || normalized.includes("range") || normalized.includes("tooltip")) {
    return [
      "History lets you investigate how a symbol's score, price, decision, and confidence changed over time.",
      "Use range filters like 7D, 14D, 1M, 6M, 1Y, or custom From/To dates. Custom dates override the preset range until cleared.",
      "Hover or tap chart points to inspect the exact observation under the cursor.",
    ].join("\n");
  }
  if (normalized.includes("onboarding") || normalized.includes("how do i use") || normalized.includes("workflow")) {
    return [
      "Start with Terminal: read Today's Action, then Decision Reasons, then What To Watch.",
      "Use Opportunities to compare research setups, History to inspect symbol changes, and Alerts to monitor conditions without constantly checking the app.",
      "The intended workflow is slower and more selective than signal-chasing: wait first, then investigate.",
    ].join("\n");
  }
  const match = SUPPORT_FAQ.find((item) => normalized.includes(item.slug.replaceAll("-", " ")) || normalized.includes(item.question.toLowerCase().replace("?", "")));
  if (match) return match.answer;
  if (normalized.includes("cancel") || normalized.includes("renew") || normalized.includes("billing")) return SUPPORT_FAQ.find((item) => item.slug === "cancel-renew")?.answer ?? defaultSupportAnswer();
  if (normalized.includes("alert")) return SUPPORT_FAQ.find((item) => item.slug === "alerts")?.answer ?? defaultSupportAnswer();
  if (normalized.includes("paper")) return SUPPORT_FAQ.find((item) => item.slug === "paper-trading")?.answer ?? defaultSupportAnswer();
  if (normalized.includes("wait")) return SUPPORT_FAQ.find((item) => item.slug === "wait")?.answer ?? defaultSupportAnswer();
  if (normalized.includes("watch")) return SUPPORT_FAQ.find((item) => item.slug === "watch")?.answer ?? defaultSupportAnswer();
  if (normalized.includes("avoid")) return SUPPORT_FAQ.find((item) => item.slug === "avoid")?.answer ?? defaultSupportAnswer();
  return defaultSupportAnswer();
}

function defaultSupportAnswer(): string {
  return "I can help with product navigation, feature explanations, billing steps, and troubleshooting. For account-specific help, open a support ticket from Support -> Tickets.";
}
