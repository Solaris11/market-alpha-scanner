"use client";

import { useMemo, useState } from "react";
import { csrfFetch } from "@/lib/client/csrf-fetch";
import type { ResearchCopilotAnswer } from "@/lib/trading/research-copilot";
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
  "Why is AMD ranked above MU today?",
  "What changed since yesterday?",
  "Why is the system cautious?",
  "Which setups fit my profile best?",
];

export function ConversationalResearchCopilotPanel() {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      content: "Ask about rankings, fragility, market state, historical analogs, or what changed. Answers use TradeVeto's latest structured data packet.",
      id: "welcome",
      role: "assistant",
    },
  ]);
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

  async function ask(nextQuestion: string): Promise<void> {
    const trimmed = nextQuestion.replace(/\s+/g, " ").trim();
    if (!trimmed || submitting) return;
    const userMessage: CopilotMessage = { content: trimmed, id: messageId("user"), role: "user" };
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setStatus(null);
    setSubmitting(true);
    try {
      const response = await csrfFetch("/api/research/copilot", {
        body: JSON.stringify({ history, question: trimmed }),
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
      setStatus(error instanceof Error ? error.message : "Research copilot is unavailable.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <GlassPanel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle eyebrow="Research Copilot" title="Ask TradeVeto" meta="premium Q&A" />
        <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
          Grounded
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {messages.slice(-5).map((message) => <MessageBubble key={message.id} message={message} />)}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((item) => (
          <button
            className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-left text-[11px] font-semibold text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            key={item}
            onClick={() => void ask(item)}
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
              void ask(question);
            }
          }}
          placeholder="Ask why one symbol ranks above another, what changed, or what could break a setup."
          value={question}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] leading-5 text-slate-500">Research only. The copilot cannot override deterministic TradeVeto scores.</p>
          <button
            className="rounded-full border border-cyan-300/25 bg-cyan-400/15 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-50 transition hover:border-cyan-200/55 hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting || !question.trim()}
            onClick={() => void ask(question)}
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

function MessageBubble({ message }: { message: CopilotMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`rounded-2xl border p-3 ${isUser ? "border-cyan-300/20 bg-cyan-400/[0.07]" : "border-white/10 bg-white/[0.035]"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{isUser ? "You" : "TradeVeto"}</div>
        {message.answer ? <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">{message.answer.source}</div> : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-200">{message.content}</p>
      {message.answer ? <AnswerDetails answer={message.answer} /> : null}
    </div>
  );
}

function AnswerDetails({ answer }: { answer: ResearchCopilotAnswer }) {
  return (
    <div className="mt-3 space-y-3">
      <CompactList items={answer.keyPoints} title="Evidence" />
      {answer.symbolComparisons.length ? <CompactList items={answer.symbolComparisons} title="Comparison" /> : null}
      <CompactList items={answer.whatToWatch} title="Watch Next" />
      <div className="rounded-xl border border-white/10 bg-slate-950/35 px-3 py-2 text-[11px] leading-5 text-slate-500">{answer.safetyLanguage}</div>
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

function messageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
