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
    answer: "WAIT means the system does not see conditions that justify an active trade plan. The correct action is to do nothing and wait for better conditions.",
  },
  {
    slug: "watch",
    question: "What does WATCH mean?",
    answer: "WATCH means a setup may be forming, but it is not yet a complete research signal. It belongs on a review list, not in an execution workflow.",
  },
  {
    slug: "buy",
    question: "What does BUY mean?",
    answer: "BUY is a research signal label used inside the product. It is not an instruction to buy and it is not personalized financial advice.",
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
