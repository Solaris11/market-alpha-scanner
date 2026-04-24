import { NextResponse } from "next/server";
import { readAlertRules, sanitizeAlertRule, writeAlertRules } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const rules = await readAlertRules();
    const index = rules.findIndex((rule) => rule.id === id);
    if (index === -1) {
      return NextResponse.json({ ok: false, error: `Alert rule not found: ${id}` }, { status: 404 });
    }
    const updated = sanitizeAlertRule({ ...rules[index], ...payload, id }, rules[index]);
    const nextRules = [...rules];
    nextRules[index] = updated;
    await writeAlertRules(nextRules);
    return NextResponse.json({ ok: true, rule: updated });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to update alert rule." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const rules = await readAlertRules();
  const nextRules = rules.filter((rule) => rule.id !== id);
  if (nextRules.length === rules.length) {
    return NextResponse.json({ ok: false, error: `Alert rule not found: ${id}` }, { status: 404 });
  }
  await writeAlertRules(nextRules);
  return NextResponse.json({ ok: true });
}
