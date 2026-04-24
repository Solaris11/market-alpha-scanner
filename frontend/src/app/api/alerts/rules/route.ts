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
    if (rules.some((rule) => rule.id === nextRule.id)) {
      return NextResponse.json({ ok: false, error: `Alert rule already exists: ${nextRule.id}` }, { status: 409 });
    }
    await writeAlertRules([...rules, nextRule]);
    return NextResponse.json({ ok: true, rule: nextRule });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to create alert rule." }, { status: 400 });
  }
}
