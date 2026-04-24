import { AlertsWorkspace } from "@/components/alerts/alerts-workspace";
import { TerminalShell } from "@/components/shell";
import { getAlertOverview } from "@/lib/alerts";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const overview = await getAlertOverview();

  return (
    <TerminalShell>
      <AlertsWorkspace initialOverview={overview} />
    </TerminalShell>
  );
}
