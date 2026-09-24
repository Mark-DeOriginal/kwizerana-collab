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

  const trades = await dbQuery<{
    buyer_id: string;
    seller_id: string;
    status: string;
    vendor_id: string;
    initiator_id: string;
  }>(
    `SELECT t.buyer_id, t.seller_id, t.status, ad.user_id AS vendor_id,
            CASE WHEN t.buyer_id = ad.user_id THEN t.seller_id ELSE t.buyer_id END AS initiator_id
     FROM p2p_trades t
     JOIN p2p_ads ad ON ad.id = t.ad_id
     WHERE t.id = $1`,
    [input.tradeId]
  );
  const trade = trades[0];
  if (!trade) throw new Error("Trade not found.");
  if (trade.initiator_id !== userId) throw new Error("Only the customer can rate the vendor for this trade.");

  const customerSoldCrypto = trade.initiator_id === trade.seller_id;
  const canRate = trade.status === "completed" || (customerSoldCrypto && trade.status === "released");
  if (!canRate) throw new Error("This trade must be completed before the vendor can be rated.");

  const revieweeId = trade.vendor_id;

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

function revieweeIds(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

export async function listReviewsForUser(revieweeId: string | string[], limit = 20): Promise<PublicReview[]> {
  await ensureDatabase();
  return dbQuery<PublicReview>(
    `SELECT r.id::TEXT AS id, r.trade_id::TEXT AS trade_id, r.reviewer_id, r.reviewee_id,
            r.rating, r.comment, r.created_at, u.name AS reviewer_name
     FROM p2p_reviews r
     JOIN users u ON u.id = r.reviewer_id
     WHERE r.reviewee_id = ANY($1)
     ORDER BY r.created_at DESC
     LIMIT $2`,
    [revieweeIds(revieweeId), limit]
  );
}

export type RatingSummary = {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
};

export async function getRatingSummary(revieweeId: string | string[]): Promise<RatingSummary> {
  await ensureDatabase();
  const rows = await dbQuery<{ rating: string; count: string }>(
    `SELECT rating, COUNT(*)::TEXT AS count
     FROM p2p_reviews
     WHERE reviewee_id = ANY($1)
     GROUP BY rating`,
    [revieweeIds(revieweeId)]
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
export async function getVendorAverageStars(revieweeId: string | string[]): Promise<{ avg: number; count: number } | null> {
  await ensureDatabase();
  const rows = await dbQuery<{ avg: string; count: string }>(
    `SELECT AVG(COALESCE(star_rating, CASE rating WHEN 'positive' THEN 5 WHEN 'neutral' THEN 3 ELSE 1 END))::NUMERIC(4,1) AS avg,
            COUNT(*)::TEXT AS count
     FROM p2p_reviews WHERE reviewee_id = ANY($1)`,
    [revieweeIds(revieweeId)]
  );
  const r = rows[0];
  if (!r || Number(r.count) === 0) return null;
  return { avg: Number(r.avg), count: Number(r.count) };
}
