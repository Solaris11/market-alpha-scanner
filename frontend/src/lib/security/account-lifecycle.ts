export function accountDeletionBlockedBySubscription(input: { currentPeriodEnd?: Date | string | null; status: string | null }): boolean {
  return input.status === "active" || input.status === "trialing";
}
