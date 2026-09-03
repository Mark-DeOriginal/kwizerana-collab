import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/p2p/cron-auth";
import { refreshRates } from "@/lib/p2p/price-feed";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    await refreshRates();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Refresh failed." }, { status: 500 });
  }
}
