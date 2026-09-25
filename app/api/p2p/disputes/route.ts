import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { getMyDisputesChangedAt, listMyDisputes } from "@/lib/p2p/disputes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const digestOnly = new URL(request.url).searchParams.get("digest") === "1";
  if (digestOnly) {
    return NextResponse.json({ changedAt: await getMyDisputesChangedAt(userId) });
  }
  const disputes = await listMyDisputes(userId);
  const changedAt = disputes.reduce(
    (latest, dispute) => dispute.updated_at > latest ? dispute.updated_at : latest,
    ""
  );
  return NextResponse.json({ disputes, changedAt });
}
