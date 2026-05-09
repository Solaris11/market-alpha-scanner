import type { NarrativeIntelligence } from "@/lib/trading/narrative-intelligence";
import { personalizedSignalFit, type UserPersonalizationProfile } from "@/lib/trading/personalized-intelligence";
import type { RankingRow } from "@/lib/types";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function PersonalizedIntelligenceCard({
  narrative,
  profile,
  row,
}: {
  narrative: NarrativeIntelligence | null;
  profile: UserPersonalizationProfile | null;
  row: RankingRow;
}) {
  if (!profile) return null;
  const fit = personalizedSignalFit(row, narrative, profile);
  return (
    <GlassPanel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle eyebrow="Personalized Intelligence" title="Profile Fit" meta={profile.label} />
        <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
          {fit.fitLabel}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{fit.fitReason}</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Why it may conflict</div>
          <p className="mt-2 text-xs leading-5 text-slate-400">{fit.conflictReason}</p>
        </div>
        <div className="rounded-2xl border border-amber-300/20 bg-amber-400/[0.06] p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">Personalized warning</div>
          <p className="mt-2 text-xs leading-5 text-amber-100">{fit.profileWarning}</p>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 p-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">What to monitor next</div>
        <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-300">
          {fit.monitorNext.map((item) => <li key={item}>- {item}</li>)}
        </ul>
      </div>
    </GlassPanel>
  );
}
