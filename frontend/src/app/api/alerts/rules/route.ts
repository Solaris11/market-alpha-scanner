import { NextResponse } from "next/server";
import { getAlertOverview, readAlertRules, sanitizeAlertRule, writeAlertRules } from "@/lib/alerts";
import { accessDenied, requireUser } from "@/lib/server/access-control";
import { entitlementForUser, entitlementSummary, getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const entitlement = await getEntitlement();
  const premium = hasPremiumAccess(entitlement);
  const overview = await getAlertOverview({ createDefault: premium ? undefined : false });
  if (!premium) {
    const rules = overview.rules.slice(0, 2);
    return NextResponse.json({
      ...overview,
      rules,
      state: { alerts: {} },
      activeCount: rules.filter((rule) => rule.enabled).length,
      lastSentAt: null,
      limited: true,
      message: "Limited alert preview. Premium unlocks saved alert automation.",
      entitlement: entitlementSummary(entitlement),
    });
  }

  return NextResponse.json({ ...overview, limited: false, entitlement: entitlementSummary(entitlement) });
}

export async function POST(request: Request) {
  const rateLimited = rateLimitRequest(request, "alerts:rules:write", { limit: 40, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireUser("Sign in to save alert rules.");
  if (!access.ok) return access.response;
  if (!hasPremiumAccess(entitlementForUser(access.user))) {
    return accessDenied("Premium plan required.", 403);
  }

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const rules = await readAlertRules({ userId: access.user.id });
    const nextRule = sanitizeAlertRule(payload);
    const index = rules.findIndex((rule) => rule.id === nextRule.id);
    if (index >= 0) {
      const updated = sanitizeAlertRule({ ...rules[index], ...payload, id: nextRule.id }, rules[index]);
      const nextRules = [...rules];
      nextRules[index] = updated;
      await writeAlertRules(nextRules, { userId: access.user.id });
      return NextResponse.json({ ok: true, message: "Alert rule updated.", rule: updated, mode: "updated" });
    }
    await writeAlertRules([...rules, nextRule], { userId: access.user.id });
    return NextResponse.json({ ok: true, message: "Alert rule saved.", rule: nextRule, mode: "created" });
  } catch (error) {
    console.warn("[alerts] failed to save alert rule", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, message: "Failed to save alert rule." }, { status: 400 });
  }
}
