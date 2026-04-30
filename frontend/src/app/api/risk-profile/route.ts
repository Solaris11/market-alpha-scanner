import { GET as readUserRiskProfile, PUT as updateUserRiskProfile } from "../user/risk-profile/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return readUserRiskProfile();
}

export async function PUT(request: Request) {
  return updateUserRiskProfile(request);
}

export async function POST(request: Request) {
  return updateUserRiskProfile(request);
}
