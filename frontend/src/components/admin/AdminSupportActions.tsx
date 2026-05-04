"use client";

import { useState } from "react";
import { csrfFetch } from "@/lib/client/csrf-fetch";

export function AdminSupportReplyForm({ ticketId }: { ticketId: string }) {
  const [status, setStatus] = useState<string | null>(null);
  async function submit(formData: FormData) {
    setStatus("Sending...");
    try {
      const response = await csrfFetch(`/api/admin/support/tickets/${ticketId}/reply`, {
        body: JSON.stringify({ message: formData.get("message") }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("Unable to send admin reply.");
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send admin reply.");
    }
  }
  return (
    <form action={submit} className="grid gap-3">
      <textarea className="min-h-28 rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none" name="message" placeholder="Admin reply" required />
      <button className="w-fit rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100" type="submit">Send reply</button>
      {status ? <p className="text-sm text-slate-400">{status}</p> : null}
    </form>
  );
}

export function AdminSupportStatusForm({ priority, status, ticketId }: { priority: string; status: string; ticketId: string }) {
  async function submit(formData: FormData) {
    const response = await csrfFetch(`/api/admin/support/tickets/${ticketId}/status`, {
      body: JSON.stringify({ priority: formData.get("priority"), status: formData.get("status") }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    if (response.ok) window.location.reload();
  }
  return (
    <form action={submit} className="flex flex-wrap gap-2">
      <select className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100" defaultValue={status} name="status">
        {["open", "pending", "resolved", "closed"].map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <select className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100" defaultValue={priority} name="priority">
        {["low", "normal", "high", "urgent"].map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <button className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100" type="submit">Update</button>
    </form>
  );
}
