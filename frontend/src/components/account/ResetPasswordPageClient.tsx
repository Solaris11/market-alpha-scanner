"use client";

import { useRouter } from "next/navigation";
import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { UtilityCard, UtilityHero, UtilityPageStack, UtilityStatusRows } from "@/components/utility/CinematicUtilitySurface";
import { ResetPasswordForm } from "./ResetPasswordForm";

export function ResetPasswordPageClient({ token }: { token: string }) {
  const router = useRouter();

  if (!token) {
    return (
      <UtilityPageStack className="mx-auto max-w-4xl">
        <UtilityHero
          actions={[{ href: "/login", label: "Request new link" }, { href: "/terminal", label: "Back to terminal", variant: "secondary" }]}
          eyebrow="Password reset"
          metrics={[
            { detail: "Reset links must include a valid token.", label: "Token", tone: "rose", value: "Missing" },
            { detail: "No account details were exposed.", label: "Privacy", tone: "emerald", value: "Protected" },
          ]}
          right={<KeyRound className="mx-auto h-24 w-24 text-cyan-100" />}
          subtitle="Request a new password reset link from the sign-in screen. TradeVeto does not reveal whether an email address exists."
          title="Reset link missing"
          tone="amber"
        />
      </UtilityPageStack>
    );
  }

  return (
    <UtilityPageStack className="mx-auto max-w-5xl">
      <UtilityHero
        eyebrow="Account security"
        metrics={[
          { detail: "Reset token received by the route.", label: "Token", tone: "emerald", value: "Present" },
          { detail: "After success, you return to the terminal.", label: "Next", tone: "cyan", value: "Resume" },
          { detail: "Financial advice boundary remains unchanged.", label: "Mode", tone: "violet", value: "Research" },
        ]}
        right={
          <UtilityCard eyebrow="Security flow" icon={<LockKeyhole className="h-5 w-5" />} title="Choose a new password" tone="cyan">
            <ResetPasswordForm onSuccess={() => router.push("/terminal")} token={token} />
          </UtilityCard>
        }
        subtitle="Update credentials through a focused security workflow while preserving account context and returning directly to TradeVeto."
        title="Secure your access"
        tone="cyan"
      >
        <UtilityStatusRows
          items={[
            { detail: "Password changes never touch scanner data, watchlists, alerts, or decision memory.", label: "Account memory", tone: "emerald", value: "Preserved" },
            { detail: "Reset requests are intentionally generic so account enumeration is not exposed.", label: "Privacy posture", tone: "cyan", value: "Protected" },
            { detail: "Support is available if the link expired or the inbox cannot receive the reset email.", label: "Fallback path", tone: "amber", value: "Support" },
          ]}
        />
      </UtilityHero>
      <UtilityCard href="/support" icon={<ShieldCheck className="h-5 w-5" />} title="Need help with account access?" tone="violet">
        <p className="text-sm leading-6 text-slate-400">Open support for account recovery or billing navigation. Do not include passwords, tokens, or private financial account data.</p>
      </UtilityCard>
    </UtilityPageStack>
  );
}
