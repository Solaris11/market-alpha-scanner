"use client";

import Link from "next/link";
import { Keyboard, ShieldCheck, Target } from "lucide-react";
import { UtilityCard, UtilityStatusRows } from "@/components/utility/CinematicUtilitySurface";
import {
  UTILITY_ACCESSIBILITY_REQUIREMENTS,
  utilitySurfaceById,
  utilitySurfaceCapabilityCoverage,
  type UtilitySurfaceId,
} from "@/lib/ui/utility-accessibility-maturity";

export function UtilitySurfaceMaturityPanel({
  className = "",
  surfaceId,
}: {
  className?: string;
  surfaceId: UtilitySurfaceId;
}) {
  const surface = utilitySurfaceById(surfaceId);
  const coverage = utilitySurfaceCapabilityCoverage(surface);
  return (
    <UtilityCard className={className} eyebrow="Utility maturity" icon={<ShieldCheck className="h-5 w-5" />} title={`${surface.title} trust checklist`} tone="emerald">
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/38 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">Target</div>
              <div className="mt-1 text-2xl font-black text-slate-50">{surface.scoreTarget}+</div>
            </div>
            <div className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-100">
              {coverage}% checklist coverage
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {surface.capabilities.map((capability) => (
              <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.035] p-2" key={capability}>
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
                <span className="text-xs leading-5 text-slate-300">{capability}</span>
              </div>
            ))}
          </div>
          <Link className="mt-3 inline-flex min-h-10 items-center rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-xs font-black text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15" href={surface.route}>
            Open {surface.title}
          </Link>
        </div>
        <div className="grid gap-3">
          <UtilityStatusRows
            items={surface.operatingProof.slice(0, 3).map((detail, index) => ({
              detail,
              label: `Operational proof ${index + 1}`,
              tone: "cyan" as const,
              value: "Visible",
            }))}
          />
          <div className="rounded-2xl border border-violet-300/18 bg-violet-400/[0.055] p-3">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-violet-100">
              <Keyboard className="h-4 w-4" />
              Accessibility gate
            </div>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-300">
              {UTILITY_ACCESSIBILITY_REQUIREMENTS.slice(0, 4).map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </UtilityCard>
  );
}
