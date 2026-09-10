import { ChevronRight } from "lucide-react";

/**
 * A collapsible section wrapper for /terminal.
 *
 * The page had exactly one collapse point across ~24 top-level sections, so
 * every panel competed for the same vertical space regardless of how often a
 * trader needed it. This is the layering primitive: it hides nothing
 * permanently and removes nothing, it just lets a group start closed.
 *
 * Built on <details>/<summary> deliberately rather than React state:
 *
 *   - it works before hydration, which matters because most of what it wraps
 *     is server-rendered
 *   - keyboard and screen-reader behaviour is the browser's, not a
 *     reimplementation of it
 *   - browser in-page find (Chrome) can open a closed section to reveal a
 *     match, so collapsed content stays findable
 *
 * The chevron animates only under motion-safe, so `prefers-reduced-motion`
 * turns it into an instant state change rather than a transition.
 */
export function TerminalSection({
  title,
  meta,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  meta?: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] [&[open]>summary]:border-b [&[open]>summary]:border-white/10"
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-sky-400/60 [&::-webkit-details-marker]:hidden"
      >
        <ChevronRight
          size={14}
          aria-hidden
          className="shrink-0 text-slate-400 motion-safe:transition-transform motion-safe:duration-200 group-open:rotate-90"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-100">{title}</span>
          {hint ? <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-500">{hint}</span> : null}
        </span>
        {meta ? (
          <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {meta}
          </span>
        ) : null}
      </summary>
      {/* No max-height animation: the contents are tall and variable, and
          animating height on a panel this size is where the jank would be. */}
      <div className="space-y-4 p-3 md:p-4">{children}</div>
    </details>
  );
}
