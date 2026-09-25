import { dbQuery, ensureDatabase } from "@/lib/db";
import { randomUUID } from "crypto";
import { createNotification, notifyByEmail } from "@/lib/p2p/notifications";
import { verifyEscrowTransaction } from "@/lib/p2p/chain-verification";
import { getEscrowAddress, isEscrowDeployed } from "@/lib/web3/escrow";

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
  await Promise.allSettled([
    createNotification(userId, {
      type: "trade_disputed",
      title: "Dispute submitted",
      body: "Your dispute was submitted for administrator review. Add any supporting evidence in the dispute center.",
      data: { tradeId: input.tradeId, disputeId: inserted[0].id }
    }),
    createNotification(counterpartyId, {
      type: "trade_disputed",
      title: "Dispute opened",
      body: "The other party opened a dispute for this trade. Review the case and provide your evidence in the dispute center.",
      data: { tradeId: input.tradeId, disputeId: inserted[0].id }
    })
  ]);
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
  updated_at: string;
  counterparty: string;
  my_side: "buyer" | "seller";
  evidence_buyer: DisputeEvidence[];
  evidence_seller: DisputeEvidence[];
};

export type DisputeEvidence = {
  id: string;
  author_id: string;
  side: "buyer" | "seller";
  description: string;
  image_url?: string;
  created_at: string;
};

/** Disputes the current user is involved in (as raiser or counterparty). */
export async function listMyDisputes(userId: string): Promise<DisputeDetail[]> {
  await ensureDatabase();
  const rows = await dbQuery<DisputeDetail & { buyer_id: string; seller_id: string; buyer_name: string; seller_name: string; is_buyer_identity: boolean }>(
    `WITH identities AS (
       SELECT $1::TEXT AS id
       UNION ALL
       SELECT id::TEXT FROM users WHERE owner_user_id = $1
     )
     SELECT d.id::TEXT AS id, d.trade_id::TEXT AS trade_id, t.trade_ref,
            t.crypto_currency, t.crypto_amount::TEXT AS crypto_amount,
            t.fiat_currency, t.fiat_amount::TEXT AS fiat_amount,
            d.raised_by, d.reason, d.status, d.resolution, d.resolved_at, d.created_at, d.updated_at,
            d.evidence_buyer, d.evidence_seller,
            t.buyer_id, t.seller_id, b.name AS buyer_name, s.name AS seller_name,
            (t.buyer_id IN (SELECT id FROM identities)) AS is_buyer_identity
     FROM p2p_disputes d
     JOIN p2p_trades t ON t.id = d.trade_id
     JOIN users b ON b.id = t.buyer_id
     JOIN users s ON s.id = t.seller_id
     WHERE t.buyer_id IN (SELECT id FROM identities) OR t.seller_id IN (SELECT id FROM identities)
     ORDER BY d.created_at DESC`,
    [userId]
  );
  return rows.map((r) => {
    const my_side = r.is_buyer_identity ? ("buyer" as const) : ("seller" as const);
    return {
      ...r,
      crypto_amount: Number(r.crypto_amount),
      fiat_amount: Number(r.fiat_amount),
      counterparty: my_side === "buyer" ? r.seller_name : r.buyer_name,
      my_side
    };
  });
}

export async function getMyDisputesChangedAt(userId: string): Promise<string> {
  await ensureDatabase();
  const rows = await dbQuery<{ changed_at: string | null }>(
    `WITH identities AS (
       SELECT $1::TEXT AS id
       UNION ALL
       SELECT id::TEXT FROM users WHERE owner_user_id = $1
     )
     SELECT MAX(d.updated_at)::TEXT AS changed_at
     FROM p2p_disputes d
     JOIN p2p_trades t ON t.id = d.trade_id
     WHERE t.buyer_id IN (SELECT id FROM identities) OR t.seller_id IN (SELECT id FROM identities)`,
    [userId]
  );
  return rows[0]?.changed_at ?? "";
}

export async function addDisputeEvidence(
  userId: string,
  disputeId: string,
  input: { description?: string; imageUrl?: string }
): Promise<DisputeEvidence> {
  await ensureDatabase();
  const rows = await dbQuery<{
    trade_id: string; status: string; buyer_id: string; seller_id: string;
    buyer_owner_id: string | null; seller_owner_id: string | null;
  }>(
    `SELECT d.trade_id::TEXT AS trade_id, d.status, t.buyer_id, t.seller_id,
            buyer.owner_user_id AS buyer_owner_id, seller.owner_user_id AS seller_owner_id
     FROM p2p_disputes d
     JOIN p2p_trades t ON t.id = d.trade_id
     JOIN users buyer ON buyer.id = t.buyer_id
     JOIN users seller ON seller.id = t.seller_id
     WHERE d.id = $1`,
    [disputeId]
  );
  const dispute = rows[0];
  if (!dispute) throw new Error("Dispute not found.");
  if (dispute.status !== "open") throw new Error("Evidence can only be added to an open dispute.");

  const side = dispute.buyer_id === userId || dispute.buyer_owner_id === userId
    ? "buyer"
    : dispute.seller_id === userId || dispute.seller_owner_id === userId
      ? "seller"
      : null;
  if (!side) throw new Error("You are not a participant in this dispute.");

  const description = input.description?.trim() ?? "";
  const imageUrl = input.imageUrl?.trim() ?? "";
  if (!description && !imageUrl) throw new Error("Add a description or an image as evidence.");
  if (description.length > 2000) throw new Error("Evidence notes must be 2,000 characters or fewer.");
  if (imageUrl && (!/^data:image\/(jpeg|png|webp);base64,/.test(imageUrl) || imageUrl.length > 2_500_000)) {
    throw new Error("Upload a JPG, PNG, or WebP image smaller than 2 MB.");
  }

  const evidence: DisputeEvidence = {
    id: randomUUID(),
    author_id: userId,
    side,
    description,
    ...(imageUrl ? { image_url: imageUrl } : {}),
    created_at: new Date().toISOString()
  };
  const column = side === "buyer" ? "evidence_buyer" : "evidence_seller";
  await dbQuery(
    `UPDATE p2p_disputes
     SET ${column} = ${column} || $2::jsonb, updated_at = NOW()
     WHERE id = $1 AND status = 'open'`,
    [disputeId, JSON.stringify([evidence])]
  );

  const counterpartyId = side === "buyer"
    ? dispute.seller_owner_id || dispute.seller_id
    : dispute.buyer_owner_id || dispute.buyer_id;
  await createNotification(counterpartyId, {
    type: "trade_dispute_evidence",
    title: "New dispute evidence",
    body: "The other party added evidence to your open dispute. Review it in the dispute center.",
    data: { tradeId: dispute.trade_id, disputeId }
  }).catch(() => {});

  return evidence;
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
  evidence_buyer: DisputeEvidence[];
  evidence_seller: DisputeEvidence[];
};

export async function listAllDisputes(): Promise<AdminDispute[]> {
  await ensureDatabase();
  return dbQuery<AdminDispute>(
    `SELECT d.id::TEXT AS id, d.trade_id::TEXT AS trade_id, t.trade_ref,
            d.reason, d.status, d.resolution, d.raised_by, t.receipt_image,
            d.evidence_buyer, d.evidence_seller,
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

  const rows = await dbQuery<{
    trade_id: string; trade_ref: string; buyer_id: string; seller_id: string;
    buyer_owner_id: string | null; seller_owner_id: string | null;
    buyer_wallet_address: string | null; seller_wallet_address: string | null;
    crypto_currency: string; crypto_amount: string; status: string;
    escrow_contract_address: string | null; seller_is_advertiser: boolean;
  }>(
    `SELECT d.trade_id::TEXT AS trade_id, t.trade_ref, t.buyer_id, t.seller_id,
            buyer.owner_user_id AS buyer_owner_id, seller.owner_user_id AS seller_owner_id,
            t.buyer_wallet_address, t.seller_wallet_address, t.crypto_currency,
            t.crypto_amount::TEXT AS crypto_amount, d.status,
            escrow.contract_address AS escrow_contract_address,
            (ad.user_id = t.seller_id) AS seller_is_advertiser
     FROM p2p_disputes d
     JOIN p2p_trades t ON t.id = d.trade_id
     JOIN p2p_ads ad ON ad.id = t.ad_id
     JOIN users buyer ON buyer.id = t.buyer_id
     JOIN users seller ON seller.id = t.seller_id
     LEFT JOIN LATERAL (
       SELECT contract_address FROM p2p_escrow WHERE trade_id = t.id ORDER BY id DESC LIMIT 1
     ) escrow ON TRUE
     WHERE d.id = $1`,
    [disputeId]
  );
  const d = rows[0];
  if (!d) throw new Error("Dispute not found.");
  if (d.status !== "open") throw new Error("Dispute has already been resolved.");

  const chainBacked = Boolean(d.escrow_contract_address);
  if (chainBacked && !isEscrowDeployed()) {
    throw new Error("This trade was funded on-chain, but its escrow contract is not configured. Restore the escrow configuration before resolving it.");
  }
  if (chainBacked && d.escrow_contract_address!.toLowerCase() !== getEscrowAddress().toLowerCase()) {
    throw new Error("This trade belongs to a different escrow deployment and cannot be resolved with the configured contract.");
  }

  let proof: { blockNumber: bigint; logIndex: number } | null = null;
  if (chainBacked || isEscrowDeployed()) {
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

  if ((chainBacked || isEscrowDeployed()) && !proof) {
    throw new Error("The arbitration transaction could not be verified.");
  }

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
     ), updated_participants AS (
       UPDATE users
       SET p2p_total_trades = p2p_total_trades + 1,
           p2p_completed_trades = p2p_completed_trades + 1,
           p2p_completion_rate_30d = ROUND((p2p_completed_trades + 1)::NUMERIC / (p2p_total_trades + 1) * 100, 1),
           p2p_cumulative_counterparties = p2p_cumulative_counterparties + 1,
           updated_at = NOW()
       WHERE $4 = 'completed'
         AND EXISTS (SELECT 1 FROM resolved_dispute)
         AND (id = $10 OR id = $11)
       RETURNING id
     ), updated_inventory AS (
       UPDATE p2p_vendor_inventory
       SET declared_balance = GREATEST(declared_balance - $12::NUMERIC, 0), updated_at = NOW()
       WHERE $4 = 'completed' AND $13::BOOLEAN
         AND EXISTS (SELECT 1 FROM resolved_dispute)
         AND crypto_currency = $14
         AND user_id = COALESCE(
           (SELECT owner_user_id FROM users WHERE id = $11),
           $11
         )
       RETURNING user_id
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
      proof?.logIndex ?? null,
      d.buyer_id,
      d.seller_id,
      Number(d.crypto_amount),
      d.seller_is_advertiser,
      d.crypto_currency
    ]
  );
  if (!persisted[0]?.applied) throw new Error("Dispute has already been resolved.");

  const buyerCopy = resolution === "release_buyer"
    ? `The dispute was resolved in your favor. ${d.crypto_amount} ${d.crypto_currency} has been credited to your wallet.`
    : "The dispute was resolved in the crypto seller's favor. The trade is now closed.";
  const sellerCopy = resolution === "refund_seller"
    ? `The dispute was resolved in your favor. ${d.crypto_amount} ${d.crypto_currency} has been returned to your wallet.`
    : "The dispute was resolved in the buyer's favor. The trade is now complete.";
  const recipients = [
    { id: d.buyer_owner_id || d.buyer_id, body: buyerCopy },
    { id: d.seller_owner_id || d.seller_id, body: sellerCopy }
  ];
  await Promise.allSettled(recipients.flatMap(({ id, body }) => [
    createNotification(id, { type: "trade_dispute_resolved", title: "Dispute resolved", body, data: { tradeId: d.trade_id, disputeId } }),
    notifyByEmail(id, "Dispute resolved", body)
  ]));
}
