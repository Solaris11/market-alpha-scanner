import { CircleHelp, ShieldCheck } from "lucide-react";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { UtilityCard, UtilityHero, UtilityPageStack } from "@/components/utility/CinematicUtilitySurface";
import { SUPPORT_DISCLAIMER, SUPPORT_FAQ } from "@/lib/support/content";

export const dynamic = "force-dynamic";

export default function SupportFaqPage() {
  return (
    <TerminalShell>
      <UtilityPageStack>
        <UtilityHero
          eyebrow="FAQ"
          metrics={[
            { detail: "Questions cover decision labels, alerts, billing, data, and paper trading.", label: "Answers", tone: "cyan", value: SUPPORT_FAQ.length.toLocaleString() },
            { detail: SUPPORT_DISCLAIMER, label: "Boundary", tone: "amber", value: "Research" },
          ]}
          right={<UtilityCard icon={<ShieldCheck className="h-5 w-5" />} title="Support guardrail" tone="emerald"><p className="text-sm leading-6 text-slate-400">{SUPPORT_DISCLAIMER}</p></UtilityCard>}
          subtitle="Use FAQ as a fast product decoder for scanner labels, account flow, data freshness, alerts, and risk-first terminology."
          title="Frequently asked questions"
          tone="cyan"
        />
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {SUPPORT_FAQ.map((item) => (
            <UtilityCard eyebrow={item.slug.replaceAll("-", " ")} icon={<CircleHelp className="h-5 w-5" />} key={item.slug} title={item.question} tone="cyan">
              <p className="text-sm leading-6 text-slate-400">{item.answer}</p>
            </UtilityCard>
          ))}
        </section>
      </UtilityPageStack>
    </TerminalShell>
  );
}
