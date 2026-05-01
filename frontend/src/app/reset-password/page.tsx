import { TerminalShell } from "@/components/terminal/TerminalShell";
import { ResetPasswordPageClient } from "@/components/account/ResetPasswordPageClient";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ token?: string | string[] }>;
};

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const token = Array.isArray(params.token) ? params.token[0] ?? "" : params.token ?? "";

  return (
    <TerminalShell>
      <ResetPasswordPageClient token={token} />
    </TerminalShell>
  );
}
