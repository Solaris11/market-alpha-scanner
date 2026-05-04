import Link from "next/link";
import { AdminEmpty, AdminSection, AdminTable, StatusBadge } from "@/components/admin/AdminChrome";
import { listAdminSupportTickets } from "@/lib/server/support";
import { formatAdminDate, statusTone } from "../view-utils";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ status?: string }>;
};

export default async function AdminSupportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tickets = await listAdminSupportTickets({ status: params?.status });
  return (
    <AdminSection title="Support tickets" subtitle="Admin-only ticket queue. Replies and status changes are audit logged.">
      <form className="mb-4 flex flex-wrap gap-2">
        <select className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100" defaultValue={params?.status ?? ""} name="status">
          <option value="">All statuses</option>
          {["open", "pending", "resolved", "closed"].map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <button className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100" type="submit">Filter</button>
      </form>
      {tickets.length ? (
        <AdminTable>
          <table className="min-w-[1000px] w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-[10px] uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-3 py-3">Subject</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Priority</th>
                <th className="px-3 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {tickets.map((ticket) => (
                <tr className="text-slate-300" key={ticket.id}>
                  <td className="px-3 py-3"><Link className="font-semibold text-cyan-100 hover:text-cyan-50" href={`/admin/support/${ticket.id}`}>{ticket.subject}</Link></td>
                  <td className="px-3 py-3">{ticket.email}</td>
                  <td className="px-3 py-3">{ticket.category}</td>
                  <td className="px-3 py-3"><StatusBadge tone={statusTone(ticket.status)}>{ticket.status}</StatusBadge></td>
                  <td className="px-3 py-3">{ticket.priority}</td>
                  <td className="px-3 py-3">{formatAdminDate(ticket.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTable>
      ) : (
        <AdminEmpty>No support tickets found.</AdminEmpty>
      )}
    </AdminSection>
  );
}
