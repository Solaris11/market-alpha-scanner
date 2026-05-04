import { AdminRoleButton } from "@/components/admin/AdminActions";
import { AdminEmpty, AdminSection, AdminTable, StatusBadge } from "@/components/admin/AdminChrome";
import { listAdminUsers } from "@/lib/server/admin-data";
import { formatAdminDate, statusTone } from "../view-utils";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ q?: string; role?: string; status?: string }>;
};

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const users = await listAdminUsers({ role: params?.role, search: params?.q, subscriptionStatus: params?.status });
  return (
    <div className="space-y-5">
      <AdminSection title="Users" subtitle="Search and inspect account, onboarding, role, and subscription state. Role mutations are DB-backed and audit logged.">
        <form className="mb-4 flex flex-wrap gap-2">
          <input className="min-w-0 flex-1 rounded-full border border-white/10 bg-slate-950/80 px-4 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600" defaultValue={params?.q ?? ""} name="q" placeholder="Search email" />
          <select className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100" defaultValue={params?.role ?? ""} name="role">
            <option value="">All roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <button className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100" type="submit">Filter</button>
        </form>
        {users.length ? (
          <AdminTable>
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-[10px] uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Onboarding</th>
                  <th className="px-3 py-3">Timezone</th>
                  <th className="px-3 py-3">Risk</th>
                  <th className="px-3 py-3">Subscription</th>
                  <th className="px-3 py-3">Created</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {users.map((user) => (
                  <tr className="text-slate-300" key={user.id}>
                    <td className="px-3 py-3 font-semibold text-slate-100">{user.email}</td>
                    <td className="px-3 py-3"><StatusBadge tone={user.role === "admin" ? "good" : "default"}>{user.role}</StatusBadge></td>
                    <td className="px-3 py-3">{user.emailVerified ? "Verified" : "Unverified"}</td>
                    <td className="px-3 py-3">{user.onboardingCompleted ? "Complete" : "Required"}</td>
                    <td className="px-3 py-3">{user.timezone ?? "Not set"}</td>
                    <td className="px-3 py-3">{user.riskExperienceLevel ?? "Not set"}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        <StatusBadge tone={statusTone(user.subscriptionStatus)}>{user.subscriptionStatus ?? "free"}</StatusBadge>
                        {user.currentPeriodEnd ? <span className="text-xs text-slate-500">{formatAdminDate(user.currentPeriodEnd)}</span> : null}
                      </div>
                    </td>
                    <td className="px-3 py-3">{formatAdminDate(user.createdAt)}</td>
                    <td className="px-3 py-3"><AdminRoleButton currentRole={user.role} targetUserId={user.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTable>
        ) : (
          <AdminEmpty>No users matched.</AdminEmpty>
        )}
      </AdminSection>
    </div>
  );
}
