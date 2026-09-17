import { dbQuery, ensureDatabase } from "@/lib/db";
import { createNotification, updateTradeNotification, notifyByEmail } from "@/lib/p2p/notifications";
import { verifyEscrowTransaction } from "@/lib/p2p/chain-verification";
import { isEscrowDeployed } from "@/lib/web3/escrow";

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

  const trades = await dbQuery<{
    buyer_id: string;
    seller_id: string;
    buyer_owner_id: string | null;
    seller_owner_id: string | null;
    status: string;
  }>(
    `SELECT t.buyer_id, t.seller_id, t.status,
            buyer.owner_user_id AS buyer_owner_id,
            seller.owner_user_id AS seller_owner_id
     FROM p2p_trades t
     JOIN users buyer ON buyer.id = t.buyer_id
     JOIN users seller ON seller.id = t.seller_id
     WHERE t.id = $1`,
    [input.tradeId]
  );
  const trade = trades[0];
  if (!trade) throw new Error("Trade not found.");

  const isBuyer = trade.buyer_id === userId || trade.buyer_owner_id === userId;
  const isSeller = trade.seller_id === userId || trade.seller_owner_id === userId;
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

  const counterpartyId = isBuyer
    ? trade.seller_owner_id || trade.seller_id
    : trade.buyer_owner_id || trade.buyer_id;
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
  receipt_image: string | null;
};

export async function listAllDisputes(): Promise<AdminDispute[]> {
  await ensureDatabase();
  return dbQuery<AdminDispute>(
    `SELECT d.id::TEXT AS id, d.trade_id::TEXT AS trade_id, t.trade_ref,
            d.reason, d.status, d.resolution, d.raised_by, t.receipt_image,
            b.name AS buyer_name, s.name AS seller_name,
            d.created_at, d.resolved_at
     FROM p2p_disputes d
     JOIN p2p_trades t ON t.id = d.trade_id
     JOIN users b ON b.id = t.buyer_id
     JOIN users s ON s.id = t.seller_id
     ORDER BY (d.status = 'open') DESC, d.created_at DESC`
  );
}

export type DisputeResolution = "release_buyer" | "refund_seller";

export async function resolveDispute(adminUserId: string, disputeId: string, resolution: DisputeResolution, txHash?: string): Promise<void> {
  await ensureDatabase();

  const rows = await dbQuery<{ trade_id: string; trade_ref: string; buyer_id: string; seller_id: string; buyer_wallet_address: string | null; seller_wallet_address: string | null; crypto_currency: string; crypto_amount: string; status: string }>(
    `SELECT d.trade_id::TEXT AS trade_id, t.trade_ref, t.buyer_id, t.seller_id,
            t.buyer_wallet_address, t.seller_wallet_address, t.crypto_currency,
            t.crypto_amount::TEXT AS crypto_amount, d.status
     FROM p2p_disputes d JOIN p2p_trades t ON t.id = d.trade_id
     WHERE d.id = $1`,
    [disputeId]
  );
  const d = rows[0];
  if (!d) throw new Error("Dispute not found.");
  if (d.status !== "open") throw new Error("Dispute has already been resolved.");

  let proof: { blockNumber: bigint; logIndex: number } | null = null;
  if (isEscrowDeployed()) {
    if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) throw new Error("A valid arbitration transaction is required.");
    proof = await verifyEscrowTransaction({
      action: resolution === "release_buyer" ? "resolve_buyer" : "resolve_seller",
      txHash,
      tradeRef: d.trade_ref,
      cryptoCurrency: d.crypto_currency,
      cryptoAmount: Number(d.crypto_amount),
      buyerWalletAddress: d.buyer_wallet_address,
      sellerWalletAddress: d.seller_wallet_address,
      destinationAddress: resolution === "release_buyer" ? d.buyer_wallet_address ?? undefined : undefined
    });
  }

  const tradeStatus = resolution === "refund_seller" ? "cancelled" : "completed";

  const persisted = await dbQuery<{ applied: boolean }>(
    `WITH resolved_dispute AS (
       UPDATE p2p_disputes
       SET status = 'resolved', resolution = $2, resolved_by = $3, resolved_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'open'
       RETURNING trade_id
     ), updated_trade AS (
       UPDATE p2p_trades
       SET status = $4,
           claimed_at = CASE WHEN $4 = 'completed' THEN NOW() ELSE claimed_at END,
           cancelled_at = CASE WHEN $4 = 'cancelled' THEN NOW() ELSE cancelled_at END,
           updated_at = NOW()
       WHERE id IN (SELECT trade_id FROM resolved_dispute)
       RETURNING id
     ), updated_escrow AS (
       UPDATE p2p_escrow
       SET status = $5,
           claim_tx_hash = CASE WHEN $5 = 'claimed' THEN COALESCE($6, claim_tx_hash) ELSE claim_tx_hash END,
           refund_tx_hash = CASE WHEN $5 = 'refunded' THEN COALESCE($6, refund_tx_hash) ELSE refund_tx_hash END,
           release_to = CASE WHEN $5 = 'claimed' THEN $7 ELSE release_to END,
           released_at = NOW(),
           chain_block_number = $8::NUMERIC,
           chain_log_index = $9::INTEGER,
           chain_verified_at = CASE WHEN $8::NUMERIC IS NOT NULL THEN NOW() ELSE NULL END,
           chain_verifier_version = CASE WHEN $8::NUMERIC IS NOT NULL THEN 'escrow-events-v2' ELSE NULL END
       WHERE trade_id IN (SELECT trade_id FROM resolved_dispute)
       RETURNING trade_id
     )
     SELECT EXISTS (SELECT 1 FROM resolved_dispute) AS applied`,
    [
      disputeId,
      resolution,
      adminUserId,
      tradeStatus,
      resolution === "release_buyer" ? "claimed" : "refunded",
      txHash ?? null,
      d.buyer_wallet_address,
      proof?.blockNumber.toString() ?? null,
      proof?.logIndex ?? null
    ]
  );
  if (!persisted[0]?.applied) throw new Error("Dispute has already been resolved.");

  const copy: Record<DisputeResolution, string> = {
    release_buyer: "Resolved: crypto released to the buyer.",
    refund_seller: "Resolved: escrow refunded to the seller."
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
