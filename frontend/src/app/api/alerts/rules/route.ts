import { NextResponse } from "next/server";
import { getAlertOverview, readAlertRules, sanitizeAlertRule, writeAlertRules } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getAlertOverview());
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const rules = await readAlertRules();
    const nextRule = sanitizeAlertRule(payload);
    const index = rules.findIndex((rule) => rule.id === nextRule.id);
    if (index >= 0) {
      const updated = sanitizeAlertRule({ ...rules[index], ...payload, id: nextRule.id }, rules[index]);
      const nextRules = [...rules];
      nextRules[index] = updated;
      await writeAlertRules(nextRules);
      return NextResponse.json({ ok: true, rule: updated, mode: "updated" });
    }
    await writeAlertRules([...rules, nextRule]);
    return NextResponse.json({ ok: true, rule: nextRule, mode: "created" });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to create alert rule." }, { status: 400 });
  }
}
