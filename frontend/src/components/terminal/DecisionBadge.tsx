import { decisionBadgeClass } from "@/lib/ui/badge-style";
import { decisionLabel } from "@/lib/ui/labels";

export function DecisionBadge({ value, className = "" }: { value: unknown; className?: string }) {
  return (
    <span className={`inline-flex max-w-full min-w-0 items-center justify-center rounded-full border px-3 py-1 text-center text-xs font-bold uppercase tracking-[0.12em] ${decisionBadgeClass(value)} ${className}`}>
      {decisionLabel(value)}
    </span>
  );
}
