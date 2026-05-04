import { AdminEmpty, AdminSection, AdminTable } from "@/components/admin/AdminChrome";
import { listAdminAuditLog } from "@/lib/server/admin-data";
import { formatAdminDate } from "../view-utils";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const audit = await listAdminAuditLog();
  return (
    <AdminSection title="Admin audit log" subtitle="Every admin mutation records the actor, action, target, sanitized metadata, IP, and user agent. Secrets are filtered before storage.">
      {audit.length ? (
        <AdminTable>
          <table className="min-w-[1000px] w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-[10px] uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-3 py-3">Time</th>
                <th className="px-3 py-3">Admin</th>
                <th className="px-3 py-3">Action</th>
                <th className="px-3 py-3">Target</th>
                <th className="px-3 py-3">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {audit.map((row) => (
                <tr className="align-top text-slate-300" key={row.id}>
                  <td className="px-3 py-3">{formatAdminDate(row.createdAt)}</td>
                  <td className="px-3 py-3">{row.adminEmail ?? "Unknown admin"}</td>
                  <td className="px-3 py-3 font-semibold text-slate-100">{row.action}</td>
                  <td className="px-3 py-3">
                    <div>{row.targetType}</div>
                    {row.targetId ? <div className="mt-1 font-mono text-xs text-slate-500">{row.targetId}</div> : null}
                  </td>
                  <td className="px-3 py-3">
                    <pre className="max-w-xl whitespace-pre-wrap break-words rounded-lg bg-black/25 p-2 text-xs text-slate-400">{JSON.stringify(row.metadata, null, 2)}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTable>
      ) : (
        <AdminEmpty>No admin audit events found.</AdminEmpty>
      )}
    </AdminSection>
  );
}
