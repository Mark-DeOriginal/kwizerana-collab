import { dbQuery, ensureDatabase } from "@/lib/db";
import { createNotification, updateTradeNotification, notifyByEmail } from "@/lib/p2p/notifications";

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
  await notifyByEmail(counterpartyId, "A trade was disputed", "A dispute was opened on one of your trades. Our support team will review it and contact you with the outcome.");

  return inserted[0];
}

export type DisputeDetail = {
  id: string;
  trade_id: string;
  trade_ref: string;
  crypto_currency: string;
  crypto_amount: number;
  fiat_currency: string;
  fiat_amount: number;
  raised_by: string;
  reason: string;
  status: string;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
  counterparty: string;
  my_side: "buyer" | "seller";
};

/** Disputes the current user is involved in (as raiser or counterparty). */
export async function listMyDisputes(userId: string): Promise<DisputeDetail[]> {
  await ensureDatabase();
  const owned = await dbQuery<{ id: string }>(`SELECT id FROM users WHERE owner_user_id = $1`, [userId]);
  const ids = [userId, ...owned.map((o) => o.id)];
  const rows = await dbQuery<DisputeDetail & { buyer_id: string; seller_id: string; buyer_name: string; seller_name: string }>(
    `SELECT d.id::TEXT AS id, d.trade_id::TEXT AS trade_id, t.trade_ref,
            t.crypto_currency, t.crypto_amount::TEXT AS crypto_amount,
            t.fiat_currency, t.fiat_amount::TEXT AS fiat_amount,
            d.raised_by, d.reason, d.status, d.resolution, d.resolved_at, d.created_at,
            t.buyer_id, t.seller_id, b.name AS buyer_name, s.name AS seller_name
     FROM p2p_disputes d
     JOIN p2p_trades t ON t.id = d.trade_id
     JOIN users b ON b.id = t.buyer_id
     JOIN users s ON s.id = t.seller_id
     WHERE t.buyer_id = ANY($1) OR t.seller_id = ANY($1)
     ORDER BY d.created_at DESC`,
    [ids]
  );
  return rows.map((r) => {
    const my_side = ids.includes(r.buyer_id) ? ("buyer" as const) : ("seller" as const);
    return {
      ...r,
      crypto_amount: Number(r.crypto_amount),
      fiat_amount: Number(r.fiat_amount),
      counterparty: my_side === "buyer" ? r.seller_name : r.buyer_name,
      my_side
    };
  });
}

export type AdminDispute = {
  id: string;
  trade_id: string;
  trade_ref: string;
  reason: string;
  status: string;
  resolution: string | null;
  raised_by: string;
  buyer_name: string;
  seller_name: string;
  created_at: string;
  resolved_at: string | null;
};

export async function listAllDisputes(): Promise<AdminDispute[]> {
  await ensureDatabase();
  return dbQuery<AdminDispute>(
    `SELECT d.id::TEXT AS id, d.trade_id::TEXT AS trade_id, t.trade_ref,
            d.reason, d.status, d.resolution, d.raised_by,
            b.name AS buyer_name, s.name AS seller_name,
            d.created_at, d.resolved_at
     FROM p2p_disputes d
     JOIN p2p_trades t ON t.id = d.trade_id
     JOIN users b ON b.id = t.buyer_id
     JOIN users s ON s.id = t.seller_id
     ORDER BY (d.status = 'open') DESC, d.created_at DESC`
  );
}

export type DisputeResolution = "release_buyer" | "refund_seller" | "split";

export async function resolveDispute(adminUserId: string, disputeId: string, resolution: DisputeResolution): Promise<void> {
  await ensureDatabase();

  const rows = await dbQuery<{ trade_id: string; buyer_id: string; seller_id: string; status: string }>(
    `SELECT d.trade_id::TEXT AS trade_id, t.buyer_id, t.seller_id, d.status
     FROM p2p_disputes d JOIN p2p_trades t ON t.id = d.trade_id
     WHERE d.id = $1`,
    [disputeId]
  );
  const d = rows[0];
  if (!d) throw new Error("Dispute not found.");
  if (d.status !== "open") throw new Error("Dispute has already been resolved.");

  const tradeStatus = resolution === "refund_seller" ? "cancelled" : "completed";

  await dbQuery(
    `UPDATE p2p_disputes SET status = 'resolved', resolution = $2, resolved_by = $3, resolved_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [disputeId, resolution, adminUserId]
  );

  await dbQuery(
    `UPDATE p2p_trades SET status = $2, updated_at = NOW() WHERE id = $1`,
    [d.trade_id, tradeStatus]
  );

  const copy: Record<DisputeResolution, string> = {
    release_buyer: "Resolved: crypto released to the buyer.",
    refund_seller: "Resolved: escrow refunded to the seller.",
    split: "Resolved: funds split between both parties."
  };

  for (const uid of [d.buyer_id, d.seller_id]) {
    await createNotification(uid, {
      type: "trade_dispute_resolved",
      title: "Dispute resolved",
      body: copy[resolution],
      data: { tradeId: d.trade_id }
    });
    await notifyByEmail(uid, "Dispute resolved", copy[resolution]);
  }
}
