export const ALERT_STORAGE_BACKEND = "postgres" as const;

export type AlertAccessInput = {
  authenticated: boolean;
  isPremium: boolean;
};

export type AlertAccessState = "anonymous" | "free" | "premium";

export type PersistedAlertRuleShape = {
  allowed_actions?: string[];
  channels: string[];
  cooldown_minutes: number;
  entry_filter?: string;
  max_alerts_per_run?: number;
  min_rating?: string;
  min_risk_reward?: number;
  min_score?: number;
  source?: "system" | "user";
};

export function alertAccessState(input: AlertAccessInput): AlertAccessState {
  if (!input.authenticated) return "anonymous";
  return input.isPremium ? "premium" : "free";
}

export function alertRulePayload(rule: PersistedAlertRuleShape): Record<string, unknown> {
  return {
    allowed_actions: rule.allowed_actions,
    channels: rule.channels,
    cooldown_minutes: rule.cooldown_minutes,
    entry_filter: rule.entry_filter,
    max_alerts_per_run: rule.max_alerts_per_run,
    min_rating: rule.min_rating,
    min_risk_reward: rule.min_risk_reward,
    min_score: rule.min_score,
    source: rule.source,
  };
}

export function alertReadIsUserScoped(sql: string): boolean {
  return /\bWHERE\s+user_id\s*=\s*\$1\b/i.test(sql);
}
