import type { Metadata } from "next";
import { LegalMarketingPage } from "@/components/marketing/LegalMarketingPage";
import { marketingMetadata } from "@/lib/marketing-seo";

export const metadata: Metadata = marketingMetadata("/privacy", {
  title: "Privacy Policy — TradeVeto",
  description: "TradeVeto privacy policy for account data, sessions, watchlists, alerts, paper simulation, memory settings, and support operations.",
});

export default function PrivacyPage() {
  return (
    <LegalMarketingPage eyebrow="Privacy" title="Privacy Policy">
      <p>TradeVeto stores account, session, watchlist, risk profile, paper simulation, alert, and subscription entitlement data needed to operate the service.</p>
      <p>Passwords are stored as hashes. Session cookies are httpOnly. We do not sell user account data. Operational logs may be retained for security, abuse prevention, reliability, and support.</p>
      <p>Decision journal, user memory, and personalization features are designed to be transparent and controllable from account settings where available.</p>
      <p>Do not enter brokerage credentials or sensitive financial account information. Live broker integrations are not enabled.</p>
    </LegalMarketingPage>
  );
}
