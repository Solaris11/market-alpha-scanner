"use client";

import { useState } from "react";
import { csrfFetch } from "@/lib/client/csrf-fetch";

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
        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
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
    { role: "assistant", text: "Ask about product features, billing navigation, alerts, paper trading, or troubleshooting. I cannot provide financial advice." },
  ]);
  const [busy, setBusy] = useState(false);

  async function submit(formData: FormData) {
    const text = String(formData.get("message") ?? "").trim();
    if (!text) return;
    setMessages((current) => [...current, { role: "user", text }]);
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

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        {messages.map((message, index) => (
          <div className={message.role === "assistant" ? "text-slate-300" : "text-cyan-100"} key={`${message.role}-${index}`}>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{message.role}</div>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.text}</p>
          </div>
        ))}
      </div>
      <form action={submit} className="flex flex-col gap-3 sm:flex-row">
        <input className="min-w-0 flex-1 rounded-full border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none" disabled={busy} name="message" placeholder="Ask a product support question" />
        <button className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 disabled:opacity-50" disabled={busy} type="submit">Ask</button>
      </form>
    </div>
  );
}
