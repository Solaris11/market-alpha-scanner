import { NextResponse } from "next/server";
import { readAlertRules, readAlertState, sanitizeAlertRule, writeAlertRules, writeAlertState } from "@/lib/alerts";
import { accessDenied, requireUser } from "@/lib/server/access-control";
import { getEntitlementForUser, hasPremiumAccess, legalNotAcceptedResponse, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const rateLimited = rateLimitRequest(request, "alerts:rules:update", { limit: 60, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireUser("Sign in to update alert rules.");
  if (!access.ok) return access.response;
  const entitlement = await getEntitlementForUser(access.user);
  if (requiresLegalAcceptance(entitlement)) return legalNotAcceptedResponse(entitlement);
  if (!hasPremiumAccess(entitlement)) {
    return accessDenied("Premium plan required.", 403);
  }

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const { id } = await context.params;
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const rules = await readAlertRules({ userId: access.user.id });
    const index = rules.findIndex((rule) => rule.id === id);
    if (index === -1) {
      return NextResponse.json({ ok: false, message: "Alert rule not found." }, { status: 404 });
    }
    const updated = sanitizeAlertRule({ ...rules[index], ...payload, id }, rules[index]);
    const nextRules = [...rules];
    nextRules[index] = updated;
    await writeAlertRules(nextRules, { userId: access.user.id });
    return NextResponse.json({ ok: true, message: "Alert rule updated.", rule: updated });
  } catch (error) {
    console.warn("[alerts] failed to update alert rule", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, message: "Failed to update alert rule." }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const rateLimited = rateLimitRequest(request, "alerts:rules:delete", { limit: 60, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireUser("Sign in to delete alert rules.");
  if (!access.ok) return access.response;
  const entitlement = await getEntitlementForUser(access.user);
  if (requiresLegalAcceptance(entitlement)) return legalNotAcceptedResponse(entitlement);
  if (!hasPremiumAccess(entitlement)) {
    return accessDenied("Premium plan required.", 403);
  }

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const { id } = await context.params;
  try {
    const rules = await readAlertRules({ userId: access.user.id });
    const nextRules = rules.filter((rule) => rule.id !== id);
    if (nextRules.length === rules.length) {
      return NextResponse.json({ ok: false, message: "Alert rule not found." }, { status: 404 });
    }

    const state = await readAlertState({ userId: access.user.id });
    const prefix = `${id}:`;
    const nextAlerts = Object.fromEntries(
      Object.entries(state.alerts).filter(([key, entry]) => key !== id && !key.startsWith(prefix) && entry.alert_id !== id),
    );
    const removedStateCount = Object.keys(state.alerts).length - Object.keys(nextAlerts).length;

    await Promise.all([writeAlertRules(nextRules, { userId: access.user.id }), writeAlertState({ ...state, alerts: nextAlerts }, { userId: access.user.id })]);
    return NextResponse.json({ ok: true, message: "Alert rule deleted.", removedStateCount });
  } catch (error) {
    console.warn("[alerts] failed to delete alert rule", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, message: "Failed to delete alert rule." }, { status: 400 });
  }
}
