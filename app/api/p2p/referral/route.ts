import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { getReferralCode, countReferrals } from "@/lib/p2p/referrals";
import { getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const code = await getReferralCode(userId);
  const referredCount = await countReferrals(userId);
  const link = `${getSiteUrl()}/auth/sign-up?ref=${encodeURIComponent(code)}`;

  return NextResponse.json({ code, referredCount, link });
}
