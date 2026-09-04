import { dbQuery, ensureDatabase } from "@/lib/db";

export type Review = {
  id: string;
  trade_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: string;
  comment: string;
  created_at: string;
};

export async function createReview(
  userId: string,
  input: { tradeId: string; starRating: number; comment?: string }
): Promise<Review> {
  await ensureDatabase();

  const trades = await dbQuery<{ buyer_id: string; seller_id: string; status: string }>(
    `SELECT buyer_id, seller_id, status FROM p2p_trades WHERE id = $1`,
    [input.tradeId]
  );
  const trade = trades[0];
  if (!trade) throw new Error("Trade not found.");
  if (trade.status !== "completed") throw new Error("Only completed trades can be rated.");

  const isBuyer = trade.buyer_id === userId;
  const isSeller = trade.seller_id === userId;
  if (!isBuyer && !isSeller) throw new Error("Not your trade.");

  const revieweeId = isBuyer ? trade.seller_id : trade.buyer_id;

  const existing = await dbQuery<{ id: string }>(
    `SELECT id FROM p2p_reviews WHERE trade_id = $1 AND reviewer_id = $2`,
    [input.tradeId, userId]
  );
  if (existing.length > 0) throw new Error("You've already rated this trade.");

  const stars = Math.round(Math.min(6, Math.max(1, input.starRating)));
  const ratingLabel = stars >= 5 ? "positive" : stars >= 3 ? "neutral" : "negative";

  const inserted = await dbQuery<Review>(
    `INSERT INTO p2p_reviews (trade_id, reviewer_id, reviewee_id, rating, star_rating, comment)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id::TEXT AS id, trade_id::TEXT AS trade_id, reviewer_id, reviewee_id, rating, comment, created_at`,
    [input.tradeId, userId, revieweeId, ratingLabel, stars, input.comment ?? ""]
  );

  return inserted[0];
}

export type PublicReview = Review & { reviewer_name: string };

export async function listReviewsForUser(revieweeId: string, limit = 20): Promise<PublicReview[]> {
  await ensureDatabase();
  return dbQuery<PublicReview>(
    `SELECT r.id::TEXT AS id, r.trade_id::TEXT AS trade_id, r.reviewer_id, r.reviewee_id,
            r.rating, r.comment, r.created_at, u.name AS reviewer_name
     FROM p2p_reviews r
     JOIN users u ON u.id = r.reviewer_id
     WHERE r.reviewee_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2`,
    [revieweeId, limit]
  );
}

export type RatingSummary = {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
};

export async function getRatingSummary(revieweeId: string): Promise<RatingSummary> {
  await ensureDatabase();
  const rows = await dbQuery<{ rating: string; count: string }>(
    `SELECT rating, COUNT(*)::TEXT AS count
     FROM p2p_reviews
     WHERE reviewee_id = $1
     GROUP BY rating`,
    [revieweeId]
  );
  const summary: RatingSummary = { total: 0, positive: 0, neutral: 0, negative: 0 };
  for (const r of rows) {
    const n = Number(r.count);
    summary.total += n;
    if (r.rating === "positive") summary.positive = n;
    else if (r.rating === "neutral") summary.neutral = n;
    else if (r.rating === "negative") summary.negative = n;
  }
  return summary;
}

/** Returns the review the given user already left for a trade, if any. */
export async function getUserReviewForTrade(tradeId: string, reviewerId: string): Promise<Review | null> {
  await ensureDatabase();
  const rows = await dbQuery<{ id: string; trade_id: string; reviewer_id: string; reviewee_id: string; rating: string; comment: string; star_rating: string | null; created_at: string }>(
    `SELECT id::TEXT AS id, trade_id::TEXT AS trade_id, reviewer_id, reviewee_id, rating, comment, star_rating::TEXT AS star_rating, created_at
     FROM p2p_reviews WHERE trade_id = $1 AND reviewer_id = $2`,
    [tradeId, reviewerId]
  );
  return rows[0] ?? null;
}

/** All reviews a user has submitted (keyed by trade_id), used to show "already rated" state. */
export async function listSubmittedReviews(reviewerId: string): Promise<Review[]> {
  await ensureDatabase();
  return dbQuery<Review>(
    `SELECT id::TEXT AS id, trade_id::TEXT AS trade_id, reviewer_id, reviewee_id, rating, comment, created_at
     FROM p2p_reviews WHERE reviewer_id = $1`,
    [reviewerId]
  );
}

/** Average star rating (1–6) for a vendor, rounded to one decimal. */
export async function getVendorAverageStars(revieweeId: string): Promise<{ avg: number; count: number } | null> {
  await ensureDatabase();
  const rows = await dbQuery<{ avg: string; count: string }>(
    `SELECT AVG(star_rating)::NUMERIC(4,1) AS avg, COUNT(*)::TEXT AS count
     FROM p2p_reviews WHERE reviewee_id = $1 AND star_rating IS NOT NULL`,
    [revieweeId]
  );
  const r = rows[0];
  if (!r || Number(r.count) === 0) return null;
  return { avg: Number(r.avg), count: Number(r.count) };
}
