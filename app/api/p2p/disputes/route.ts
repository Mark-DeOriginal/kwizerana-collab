import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { listMyDisputes } from "@/lib/p2p/disputes";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const disputes = await listMyDisputes(userId);
  return NextResponse.json({ disputes });
}
