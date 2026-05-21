import { FileText, Route } from "lucide-react";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { UtilityCard, UtilityHero, UtilityPageStack, UtilityTimeline } from "@/components/utility/CinematicUtilitySurface";
import { SUPPORT_DISCLAIMER, SUPPORT_GUIDES } from "@/lib/support/content";

export const dynamic = "force-dynamic";

export default function SupportGuidesPage() {
  return (
    <TerminalShell>
      <UtilityPageStack>
        <UtilityHero
          eyebrow="Workflow Guides"
          metrics={[
            { detail: "Short operational guides route users into the right app surface.", label: "Guides", tone: "violet", value: SUPPORT_GUIDES.length.toLocaleString() },
            { detail: SUPPORT_DISCLAIMER, label: "Boundary", tone: "amber", value: "Research" },
          ]}
          right={<Route className="mx-auto h-28 w-28 text-violet-100" />}
          subtitle="Guides are designed as workflow rails: they explain where to start, what to inspect, and when to open support."
          title="How-to guides"
          tone="violet"
        />
        <section className="grid gap-4 md:grid-cols-2">
          {SUPPORT_GUIDES.map((guide) => (
            <UtilityCard eyebrow={guide.slug.replaceAll("-", " ")} icon={<FileText className="h-5 w-5" />} key={guide.slug} title={guide.title} tone="violet">
              <UtilityTimeline items={guide.body.map((step) => ({ detail: step, label: "Step", tone: "cyan" }))} />
            </UtilityCard>
          ))}
        </section>
      </UtilityPageStack>
    </TerminalShell>
  );
}
