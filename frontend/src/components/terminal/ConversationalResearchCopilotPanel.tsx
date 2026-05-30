"use client";

import { useMemo, useState } from "react";
import { csrfFetch } from "@/lib/client/csrf-fetch";
import { trackAnalyticsEvent, trackFailedAction, trackFirstUsefulAction } from "@/lib/client/analytics";
import type { ResearchCopilotAnswer, ResearchCopilotMode } from "@/lib/trading/research-copilot";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

type CopilotMessage = {
  answer?: ResearchCopilotAnswer;
  content: string;
  id: string;
  role: "assistant" | "user";
};

type CopilotResponse = {
  answer?: ResearchCopilotAnswer;
  message?: string;
  ok?: boolean;
};

const SUGGESTED_QUESTIONS = [
  "Why is AMD moving today?",
  "Show AI stocks with improving momentum.",
  "Which holdings have elevated risk?",
  "What changed since yesterday?",
  "Which symbols look similar to NVDA?",
];

export function ConversationalResearchCopilotPanel() {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      content: "Ask about rankings, what changed, shock risk, replay context, or symbol comparisons. Answers use TradeVeto's latest structured data packet.",
      id: "welcome",
      role: "assistant",
    },
  ]);
  const [mode, setMode] = useState<ResearchCopilotMode>("concise");
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const history = useMemo(
    () => messages
      .filter((message) => message.id !== "welcome")
      .slice(-6)
      .map((message) => ({ content: message.content, role: message.role })),
    [messages],
  );

  async function ask(nextQuestion: string, source: "follow_up" | "manual" | "suggested" = "manual"): Promise<void> {
    const trimmed = nextQuestion.replace(/\s+/g, " ").trim();
    if (!trimmed || submitting) return;
    trackAnalyticsEvent("copilot_question", {
      historyDepth: history.length,
      mode,
      questionLength: trimmed.length,
      source,
    }, { source: "research_copilot" });
    trackFirstUsefulAction("copilot_question", { mode, source }, { source: "research_copilot" });
    const userMessage: CopilotMessage = { content: trimmed, id: messageId("user"), role: "user" };
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setStatus(null);
    setSubmitting(true);
    try {
      const response = await csrfFetch("/api/research/copilot", {
        body: JSON.stringify({ history, mode, question: trimmed }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as CopilotResponse | null;
      if (!response.ok || !payload?.ok || !payload.answer) {
        throw new Error(payload?.message ?? "Research copilot is unavailable.");
      }
      const answer = payload.answer;
      setMessages((current) => [
        ...current,
        {
          answer,
          content: answer.answer,
          id: messageId("assistant"),
          role: "assistant",
        },
      ]);
    } catch (error) {
      trackFailedAction("research_copilot", "question_failed", { mode, source });
      setStatus(error instanceof Error ? error.message : "Research copilot is unavailable.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <GlassPanel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle eyebrow="AI Trading Copilot" title="Ask TradeVeto" meta="grounded market Q&A" />
        <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
          Traceable
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {messages.slice(-5).map((message) => <MessageBubble key={message.id} message={message} onAsk={ask} submitting={submitting} />)}
      </div>

      <div className="mt-4 inline-flex rounded-full border border-white/10 bg-slate-950/55 p-1">
        {([
          ["concise", "Concise"],
          ["deep_dive", "Deep dive"],
        ] as const).map(([value, label]) => (
          <button
            className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] transition ${
              mode === value ? "bg-cyan-400/20 text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.15)]" : "text-slate-500 hover:text-slate-200"
            }`}
            key={value}
            onClick={() => setMode(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((item) => (
          <button
            className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-left text-[11px] font-semibold text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            key={item}
            onClick={() => void ask(item, "suggested")}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <textarea
          className="min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50"
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void ask(question, "manual");
            }
          }}
          placeholder="Ask why AMD moved, show AI momentum setups, review portfolio risk, or find symbols similar to NVDA."
          value={question}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] leading-5 text-slate-500">Research only. The copilot cannot override TradeVeto scores.</p>
          <button
            className="rounded-full border border-cyan-300/25 bg-cyan-400/15 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-50 transition hover:border-cyan-200/55 hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting || !question.trim()}
            onClick={() => void ask(question, "manual")}
            type="button"
          >
            {submitting ? "Thinking" : "Ask"}
          </button>
        </div>
        {status ? <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">{status}</div> : null}
      </div>
    </GlassPanel>
  );
}

function MessageBubble({
  message,
  onAsk,
  submitting,
}: {
  message: CopilotMessage;
  onAsk: (question: string, source?: "follow_up" | "manual" | "suggested") => Promise<void>;
  submitting: boolean;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`rounded-2xl border p-3 ${isUser ? "border-cyan-300/20 bg-cyan-400/[0.07]" : "border-white/10 bg-white/[0.035]"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{isUser ? "You" : "TradeVeto"}</div>
        {message.answer ? <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">{message.answer.source} · {modeLabel(message.answer.mode)}</div> : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-200">{message.content}</p>
      {message.answer ? <AnswerDetails answer={message.answer} onAsk={onAsk} submitting={submitting} /> : null}
    </div>
  );
}

function AnswerDetails({
  answer,
  onAsk,
  submitting,
}: {
  answer: ResearchCopilotAnswer;
  onAsk: (question: string, source?: "follow_up" | "manual" | "suggested") => Promise<void>;
  submitting: boolean;
}) {
  return (
    <div className="mt-3 space-y-3">
      <CompactList items={answer.keyPoints} title="Evidence" />
      <MarketSearchList answer={answer} />
      <CopilotActionList answer={answer} />
      {answer.symbolComparisons.length ? <CompactList items={answer.symbolComparisons} title="Comparison" /> : null}
      <CompactList items={answer.whatToWatch} title="Watch Next" />
      <PersonalMemorySummary answer={answer} />
      {answer.citations.length ? <CitationList citations={answer.citations} /> : null}
      <TraceabilityList answer={answer} />
      <div className="rounded-xl border border-cyan-300/10 bg-cyan-400/[0.04] px-3 py-2 text-[11px] leading-5 text-slate-400">{answer.confidenceNote}</div>
      {answer.followUpQuestions.length ? (
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Follow Up</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {answer.followUpQuestions.map((item) => (
              <button
                className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-left text-[11px] font-semibold text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting}
                key={item}
                onClick={() => void onAsk(item, "follow_up")}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="rounded-xl border border-white/10 bg-slate-950/35 px-3 py-2 text-[11px] leading-5 text-slate-500">{answer.safetyLanguage}</div>
    </div>
  );
}

function MarketSearchList({ answer }: { answer: ResearchCopilotAnswer }) {
  const results = answer.marketSearchResults.slice(0, 4);
  if (!results.length) return null;
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Market Matches</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {results.map((result) => (
          <div className="rounded-xl border border-white/10 bg-slate-950/35 px-3 py-2" key={result.traceId}>
            <div className="flex items-center justify-between gap-2">
              <div className="font-black text-slate-100">{result.symbol}</div>
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-cyan-200">{result.rankScore}</div>
            </div>
            <div className="mt-1 text-[11px] leading-5 text-slate-400">{result.decision} · score {result.finalScore ?? "n/a"} · fragility {result.fragility}</div>
            <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">{result.matchReasons.slice(0, 2).join("; ")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CopilotActionList({ answer }: { answer: ResearchCopilotAnswer }) {
  const actions = answer.opportunityActions.slice(0, 3);
  if (!actions.length) return null;
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Research Actions</div>
      <div className="mt-2 space-y-2">
        {actions.map((action) => (
          <a className="block rounded-xl border border-cyan-300/10 bg-cyan-400/[0.04] px-3 py-2 transition hover:border-cyan-300/30" href={action.href} key={`${action.type}-${action.symbol ?? "portfolio"}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-black text-cyan-50">{action.label}</div>
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-cyan-200">{action.confidence}</div>
            </div>
            <p className="mt-1 text-[11px] leading-5 text-slate-400">{action.detail}</p>
            <p className="mt-1 text-[10px] leading-4 text-slate-600">{action.boundary}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

function PersonalMemorySummary({ answer }: { answer: ResearchCopilotAnswer }) {
  const memory = answer.personalMemory;
  const chips = [
    ...memory.watchlistSymbols.slice(0, 5),
    ...memory.favoriteSectors.slice(0, 3),
    memory.riskProfileLabel,
  ].filter((item): item is string => Boolean(item));
  if (!chips.length) return null;
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Personal Context</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {chips.map((item) => (
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[10px] font-semibold text-slate-400" key={item}>{item}</span>
        ))}
      </div>
    </div>
  );
}

function TraceabilityList({ answer }: { answer: ResearchCopilotAnswer }) {
  const traces = answer.traceability.slice(0, 5);
  if (!traces.length) return null;
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Traceability</div>
      <ul className="mt-1 space-y-1 text-[11px] leading-5 text-slate-500">
        {traces.map((trace) => <li key={trace.id}>- {trace.label}: {trace.status}</li>)}
      </ul>
    </div>
  );
}

function CompactList({ items, title }: { items: string[]; title: string }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <ul className="mt-1 space-y-1 text-xs leading-5 text-slate-300">
        {items.slice(0, 4).map((item) => <li key={item}>- {item}</li>)}
      </ul>
    </div>
  );
}

function CitationList({ citations }: { citations: ResearchCopilotAnswer["citations"] }) {
  if (!citations.length) return null;
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Sources</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {citations.slice(0, 6).map((citation) => (
          <span
            className="rounded-full border border-white/10 bg-slate-950/40 px-2.5 py-1 text-[10px] font-semibold text-slate-400"
            key={citation.id}
            title={citation.detail}
          >
            {citation.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function messageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function modeLabel(mode: ResearchCopilotMode): string {
  return mode === "deep_dive" ? "deep dive" : "concise";
}
