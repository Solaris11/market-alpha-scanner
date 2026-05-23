import type { Metadata } from "next";
import { PublicAuthRoute } from "@/components/account/PublicAuthRoute";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { marketingMetadata } from "@/lib/marketing-seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = marketingMetadata("/register", {
  title: "Join Early Access — TradeVeto",
  description: "Create a TradeVeto early-access account for research-only AI market intelligence. Optional founding invite codes are supported. Not financial advice.",
  robots: { follow: true, index: false },
});

type RegisterPageProps = {
  searchParams?: Promise<{ invite?: string | string[]; inviteCode?: string | string[] }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = (await searchParams) ?? {};
  const rawInvite = params.invite ?? params.inviteCode ?? "";
  const inviteCode = Array.isArray(rawInvite) ? rawInvite[0] ?? "" : rawInvite;

  return (
    <MarketingShell>
      <PublicAuthRoute initialInviteCode={inviteCode} mode="register" />
    </MarketingShell>
  );
}
