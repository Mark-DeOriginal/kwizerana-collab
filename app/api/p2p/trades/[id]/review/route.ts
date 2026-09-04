import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { createReview, getUserReviewForTrade } from "@/lib/p2p/reviews";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const existing = await getUserReviewForTrade(params.id, userId);
  return NextResponse.json({ reviewed: Boolean(existing), star_rating: existing?.rating ?? null });
}

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

  const starRating = Number(body.star_rating);
  if (!Number.isFinite(starRating) || starRating < 1 || starRating > 6) {
    return NextResponse.json({ error: "Rating must be between 1 and 6 stars." }, { status: 400 });
  }

  try {
    const review = await createReview(userId, { tradeId: params.id, starRating });
    return NextResponse.json({ review }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to submit review." }, { status: 400 });
  }
}
