"use client";

import { useState } from "react";
import { csrfFetch } from "@/lib/client/csrf-fetch";
import { humanizeLabel } from "@/lib/ui/labels";

const categories = ["billing", "account", "scanner", "alerts", "technical", "feedback", "other"];

export function SupportTicketForm({ anonymous = false }: { anonymous?: boolean }) {
  const [status, setStatus] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setStatus("Sending...");
    const payload = {
      category: formData.get("category"),
      email: formData.get("email"),
      message: formData.get("message"),
      subject: formData.get("subject"),
    };
    try {
      const response = anonymous
        ? await fetch("/api/support/contact", { body: JSON.stringify(payload), headers: { "Content-Type": "application/json" }, method: "POST" })
        : await csrfFetch("/api/support/tickets", { body: JSON.stringify(payload), headers: { "Content-Type": "application/json" }, method: "POST" });
      if (!response.ok) throw new Error("Unable to send support request.");
      setStatus("Support request received.");
      if (!anonymous) window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send support request.");
    }
  }

  return (
    <form action={submit} className="grid gap-3">
      {anonymous ? <input className="rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none" name="email" placeholder="Email" required type="email" /> : null}
      <input className="rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none" maxLength={180} name="subject" placeholder="Subject" required />
      <select className="rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none" name="category">
        {categories.map((category) => <option key={category} value={category}>{humanizeLabel(category)}</option>)}
      </select>
      <textarea className="min-h-36 rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none" maxLength={4000} name="message" placeholder="How can we help?" required />
      <button className="w-fit rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/70" type="submit">Send support request</button>
      {status ? <p className="text-sm text-slate-400">{status}</p> : null}
    </form>
  );
}

export function SupportReplyForm({ ticketId }: { ticketId: string }) {
  const [status, setStatus] = useState<string | null>(null);
  async function submit(formData: FormData) {
    setStatus("Sending...");
    try {
      const response = await csrfFetch(`/api/support/tickets/${ticketId}/reply`, {
        body: JSON.stringify({ message: formData.get("message") }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("Unable to send reply.");
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send reply.");
    }
  }
  return (
    <form action={submit} className="grid gap-3">
      <textarea className="min-h-28 rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none" name="message" placeholder="Reply" required />
      <button className="w-fit rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100" type="submit">Reply</button>
      {status ? <p className="text-sm text-slate-400">{status}</p> : null}
    </form>
  );
}

export function SupportChatBox() {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    { role: "assistant", text: "I can help explain TradeVeto workflows, WAIT decisions, alerts, paper simulation, billing, and troubleshooting. I cannot provide financial advice or personalized buy/sell recommendations." },
  ]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");

  async function sendMessage(rawText: string) {
    const text = rawText.trim();
    if (!text) return;
    setMessages((current) => [...current, { role: "user", text }]);
    setDraft("");
    setBusy(true);
    try {
      const response = await fetch("/api/support/chat", { body: JSON.stringify({ message: text }), headers: { "Content-Type": "application/json" }, method: "POST" });
      const payload = (await response.json()) as { message?: string };
      setMessages((current) => [...current, { role: "assistant", text: payload.message ?? "Support assistant is unavailable." }]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: "Support assistant is unavailable." }]);
    } finally {
      setBusy(false);
    }
  }

  async function submit(formData: FormData) {
    await sendMessage(String(formData.get("message") ?? ""));
  }

  const quickPrompts = [
    "Why are there no trade-ready signals today?",
    "What does Wait Pullback mean?",
    "Why does data freshness matter?",
    "How do I use alerts without overtrading?",
  ];

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.04] p-4 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Product copilot</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Ask about using the platform</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            The assistant is deterministic for beta: it explains product concepts, scanner states, billing steps, and support workflows without accessing private portfolio advice.
          </p>
        </div>
        <div className="grid gap-2">
          {quickPrompts.map((prompt) => (
            <button
              className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2 text-left text-xs font-semibold leading-5 text-slate-200 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-cyan-50"
              disabled={busy}
              key={prompt}
              onClick={() => void sendMessage(prompt)}
              type="button"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="grid max-h-[520px] gap-3 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        {messages.map((message, index) => (
          <div className={message.role === "assistant" ? "text-slate-300" : "text-cyan-100"} key={`${message.role}-${index}`}>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{message.role === "assistant" ? "Support assistant" : "You"}</div>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.text}</p>
          </div>
        ))}
      </div>
      <form action={submit} className="flex flex-col gap-3 sm:flex-row">
        <input className="min-w-0 flex-1 rounded-full border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45" disabled={busy} name="message" onChange={(event) => setDraft(event.target.value)} placeholder="Ask about scanner states, alerts, billing, or troubleshooting" value={draft} />
        <button className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 disabled:opacity-50" disabled={busy} type="submit">Ask</button>
      </form>
    </div>
  );
}
