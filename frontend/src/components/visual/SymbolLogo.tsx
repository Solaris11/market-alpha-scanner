"use client";

import { useState } from "react";
import { getSymbolVisualIdentity, symbolLogoAssetUrl } from "@/lib/visual-identity";

type SymbolLogoSize = "lg" | "md" | "sm" | "xl";

const SIZE_CLASSES: Record<SymbolLogoSize, string> = {
  lg: "h-14 w-14 text-lg",
  md: "h-11 w-11 text-sm",
  sm: "h-8 w-8 text-[11px]",
  xl: "h-20 w-20 text-2xl",
};

export function SymbolLogo({
  className = "",
  companyName,
  sector,
  showRing = true,
  size = "md",
  symbol,
}: {
  className?: string;
  companyName?: string | null;
  sector?: string | null;
  showRing?: boolean;
  size?: SymbolLogoSize;
  symbol: string;
}) {
  const [failed, setFailed] = useState(false);
  const identity = getSymbolVisualIdentity(symbol, sector, companyName);
  const logoUrl = symbolLogoAssetUrl(symbol);
  const hasLogo = Boolean(logoUrl) && !failed;
  const label = `${symbol.toUpperCase()} visual identity`;

  return (
    <span
      aria-label={label}
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-2xl border bg-slate-950/85 shadow-lg ${SIZE_CLASSES[size]} ${showRing ? "border-white/15 ring-1 ring-white/10" : "border-white/10"} ${className}`}
      style={{
        boxShadow: `0 0 30px ${identity.accentSoft}`,
      }}
      title={label}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 opacity-85"
        style={{
          background: `linear-gradient(145deg, ${identity.accentSoft}, rgba(2, 6, 23, 0.18) 54%, rgba(255,255,255,0.04))`,
        }}
      />
      {hasLogo ? (
        <img
          alt=""
          className="relative h-[62%] w-[62%] rounded-lg object-contain"
          loading="lazy"
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
          src={logoUrl ?? undefined}
        />
      ) : (
        <span className="relative font-black tracking-normal text-white" style={{ color: identity.accent }}>
          {identity.glyph}
        </span>
      )}
      <span aria-hidden="true" className="absolute inset-x-2 bottom-1 h-px rounded-full opacity-70" style={{ backgroundColor: identity.accent }} />
    </span>
  );
}

export function SymbolIdentityLine({
  companyName,
  sector,
  symbol,
}: {
  companyName?: string | null;
  sector?: string | null;
  symbol: string;
}) {
  const identity = getSymbolVisualIdentity(symbol, sector, companyName);
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-xs text-slate-400">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: identity.accent }} />
      <span className="truncate">{identity.category}</span>
    </span>
  );
}
