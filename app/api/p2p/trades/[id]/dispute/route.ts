import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { createDispute } from "@/lib/p2p/disputes";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const reason = String(body.reason ?? "").trim();
  if (!reason) {
    return NextResponse.json({ error: "Please describe the issue." }, { status: 400 });
  }

  try {
    const dispute = await createDispute(userId, { tradeId: params.id, reason });
    return NextResponse.json({ dispute }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to open dispute." }, { status: 400 });
  }
}
