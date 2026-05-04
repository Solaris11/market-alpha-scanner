export type CheckoutBlockReason = "email_not_verified" | "legal_not_accepted" | null;

export function checkoutBlockReason(input: { emailVerified: boolean; legalAccepted: boolean }): CheckoutBlockReason {
  if (!input.legalAccepted) return "legal_not_accepted";
  if (!input.emailVerified) return "email_not_verified";
  return null;
}

export function checkoutBlockMessage(reason: CheckoutBlockReason): string | null {
  if (reason === "legal_not_accepted") return "Accept the Terms, Privacy Policy, and Risk Disclosure before upgrading.";
  if (reason === "email_not_verified") return "Verify your email before upgrading.";
  return null;
}
