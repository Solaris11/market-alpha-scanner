import { AdminHeader } from "@/components/admin/AdminChrome";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { requireAdminPageUser } from "@/lib/server/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminPageUser();
  return (
    <TerminalShell>
      <AdminHeader user={user} />
      {children}
    </TerminalShell>
  );
}
