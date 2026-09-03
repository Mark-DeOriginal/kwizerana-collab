import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/p2p/cron-auth";
import { expireStaleTrades } from "@/lib/p2p/trades";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const expired = await expireStaleTrades();
  return NextResponse.json({ ok: true, expired });
}
