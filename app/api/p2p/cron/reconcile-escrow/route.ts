import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/p2p/cron-auth";
import { reconcileEscrowProjections } from "@/lib/p2p/reconciliation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await reconcileEscrowProjections()) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Reconciliation failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}

