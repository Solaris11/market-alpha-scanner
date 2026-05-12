import type { Metadata } from "next";
import { PublicAuthRoute } from "@/components/account/PublicAuthRoute";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { marketingMetadata } from "@/lib/marketing-seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = marketingMetadata("/login", {
  title: "Sign In — TradeVeto",
  description: "Sign in to TradeVeto closed beta market intelligence. Existing beta users can continue to the research terminal.",
  robots: { follow: true, index: false },
});

type LoginPageProps = {
  searchParams?: Promise<{ invite?: string | string[]; inviteCode?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const rawInvite = params.invite ?? params.inviteCode ?? "";
  const inviteCode = Array.isArray(rawInvite) ? rawInvite[0] ?? "" : rawInvite;

  return (
    <MarketingShell>
      <PublicAuthRoute initialInviteCode={inviteCode} mode="login" />
    </MarketingShell>
  );
}
