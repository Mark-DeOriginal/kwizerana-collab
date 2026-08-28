import { dbQuery, ensureDatabase } from "@/lib/db";
import { createNotification, updateTradeNotification } from "@/lib/p2p/notifications";

export type Dispute = {
  id: string;
  trade_id: string;
  raised_by: string;
  reason: string;
  status: string;
  created_at: string;
};

export async function createDispute(
  userId: string,
  input: { tradeId: string; reason: string }
): Promise<Dispute> {
  await ensureDatabase();

  const trades = await dbQuery<{ buyer_id: string; seller_id: string; status: string }>(
    `SELECT buyer_id, seller_id, status FROM p2p_trades WHERE id = $1`,
    [input.tradeId]
  );
  const trade = trades[0];
  if (!trade) throw new Error("Trade not found.");

  const isBuyer = trade.buyer_id === userId;
  const isSeller = trade.seller_id === userId;
  if (!isBuyer && !isSeller) throw new Error("Not your trade.");
  if (trade.status === "completed" || trade.status === "cancelled" || trade.status === "disputed" || trade.status === "expired") {
    throw new Error("This trade can no longer be disputed.");
  }

  const inserted = await dbQuery<Dispute>(
    `INSERT INTO p2p_disputes (trade_id, raised_by, reason, status)
     VALUES ($1, $2, $3, 'open')
     RETURNING id::TEXT AS id, trade_id::TEXT AS trade_id, raised_by, reason, status, created_at`,
    [input.tradeId, userId, input.reason]
  );

  await dbQuery(
    `UPDATE p2p_trades SET status = 'disputed', dispute_id = $2, updated_at = NOW() WHERE id = $1`,
    [input.tradeId, inserted[0].id]
  );

  const counterpartyId = isBuyer ? trade.seller_id : trade.buyer_id;
  await createNotification(counterpartyId, {
    type: "trade_disputed",
    title: "Trade disputed",
    body: `A dispute was opened on your trade. Support will review it shortly.`,
    data: { tradeId: input.tradeId }
  });
  await updateTradeNotification(input.tradeId, {
    title: "Order under dispute",
    body: `This order is now under dispute review. Support will decide the outcome.`
  });

  return inserted[0];
}
