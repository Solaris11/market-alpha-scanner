import { NextResponse } from "next/server";
import { getAlertOverview, readAlertRules, sanitizeAlertRule, writeAlertRules } from "@/lib/alerts";
import { requireUser } from "@/lib/server/access-control";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getAlertOverview());
}

export async function POST(request: Request) {
  const access = await requireUser("Sign in to save alert rules.");
  if (!access.ok) return access.response;

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
