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
  input: { tradeId: string; rating: string; comment?: string }
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

  const inserted = await dbQuery<Review>(
    `INSERT INTO p2p_reviews (trade_id, reviewer_id, reviewee_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id::TEXT AS id, trade_id::TEXT AS trade_id, reviewer_id, reviewee_id, rating, comment, created_at`,
    [input.tradeId, userId, revieweeId, input.rating, input.comment ?? ""]
  );

  return inserted[0];
}
