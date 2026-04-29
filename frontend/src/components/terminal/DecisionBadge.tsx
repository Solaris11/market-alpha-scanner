import { decisionBadgeClass } from "@/lib/ui/badge-style";
import { cleanText } from "@/lib/ui/formatters";

export function DecisionBadge({ value, className = "" }: { value: unknown; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${decisionBadgeClass(value)} ${className}`}>
      {cleanText(value)}
    </span>
  );
}
