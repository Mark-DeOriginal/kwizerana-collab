import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { createReview } from "@/lib/p2p/reviews";

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

  const rating = String(body.rating ?? "");
  const comment = body.comment ? String(body.comment) : undefined;

  if (!["positive", "neutral", "negative"].includes(rating)) {
    return NextResponse.json({ error: "Invalid rating." }, { status: 400 });
  }

  try {
    const review = await createReview(userId, { tradeId: params.id, rating, comment });
    return NextResponse.json({ review }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to submit review." }, { status: 400 });
  }
}
