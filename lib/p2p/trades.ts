import { randomBytes } from "crypto";
import { dbQuery, ensureDatabase } from "@/lib/db";
import { createNotification, updateTradeNotification } from "@/lib/p2p/notifications";

function fmtCryptoAmount(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Number(n.toFixed(6)).toLocaleString("en-US", { maximumFractionDigits: 6 });
}

type TradeNoticeRow = {
  status: string;
  trade_ref: string;
  crypto_amount: number | string;
  crypto_currency: string;
  fiat_amount: number | string;
  fiat_currency: string;
};

function tradeNoticeCopy(t: TradeNoticeRow): { title: string; body: string } {
  const amt = fmtCryptoAmount(Number(t.crypto_amount));
  const fiat = fmtCryptoAmount(Number(t.fiat_amount));
  const ref = t.trade_ref;
  switch (t.status) {
    case "escrow_locked":
      return { title: "Escrow locked — awaiting payment", body: `The escrow for order ${ref} (${amt} ${t.crypto_currency}) is funded. Waiting for the buyer to send ${fiat} ${t.fiat_currency}.` };
    case "payment_sent":
      return { title: "Payment submitted", body: `The buyer says the ${fiat} ${t.fiat_currency} for order ${ref} was sent. Review the receipt and confirm the payment.` };
    case "released":
      return { title: "Payment confirmed — crypto ready", body: `Payment confirmed for order ${ref}. The ${amt} ${t.crypto_currency} is ready to receive.` };
    case "completed":
      return { title: "Trade completed", body: `Trade ${ref} (${amt} ${t.crypto_currency}) completed.` };
    case "cancelled":
      return { title: "Order cancelled", body: `Order ${ref} was cancelled, so no funds were released.` };
    case "expired":
      return { title: "Order expired", body: `Order ${ref} expired without payment, so the escrow was not released.` };
    case "disputed":
      return { title: "Order under dispute", body: `Order ${ref} is under dispute review.` };
    default:
      return { title: "Order update", body: `Order ${ref} moved to ${t.status}.` };
  }
}

async function syncTradeNotification(tradeId: string): Promise<void> {
  const rows = await dbQuery<TradeNoticeRow>(
    `SELECT status, trade_ref, crypto_amount, crypto_currency, fiat_amount, fiat_currency
     FROM p2p_trades WHERE id = $1`,
    [tradeId]
  );
  const t = rows[0];
  if (!t) return;
  await updateTradeNotification(tradeId, tradeNoticeCopy(t));
}

export type Trade = {
  id: string;
  ad_id: string;
  trade_ref: string;
  payment_reference: string | null;
  receipt: string | null;
  receipt_image: string | null;
  crypto_currency: string;
  chain: string;
  crypto_amount: number;
  fiat_currency: string;
  fiat_amount: number;
  price_at_trade: number;
  status: string;
  buyer_id: string;
  seller_id: string;
  buyer_name: string;
  seller_name: string;
  payment_method_name: string | null;
  payment_method_type: string | null;
  payment_account_holder: string | null;
  payment_details: Record<string, unknown>;
  buyer_paid_at: string | null;
  released_at: string | null;
  expires_at: string;
  created_at: string;
  escrow_locked_at: string | null;
  claimed_at: string | null;
  seller_wallet_address: string | null;
  buyer_wallet_address: string | null;
  escrow_status: string | null;
  escrow_debit_tx: string | null;
  escrow_release_tx: string | null;
  escrow_claim_tx: string | null;
  escrow_refund_tx: string | null;
  escrow_release_to: string | null;
  my_role: "buyer" | "seller";
};

export type TradeStatus =
  | "created" // submitted, awaiting vendor approval
  | "escrow_locked" // crypto funded on-chain; buyer to pay fiat
  | "payment_sent" // buyer uploaded receipt
  | "released" // seller confirmed fiat received; buyer can claim
  | "completed" // buyer claimed crypto
  | "cancelled"
  | "expired"
  | "disputed";

export const ACTIVE_TRADE_STATUSES: TradeStatus[] = ["created", "escrow_locked", "payment_sent", "released"];

export const TRADE_STATUS_LABELS: Record<string, string> = {
  created: "Awaiting approval",
  escrow_locked: "Escrow funded — pay now",
  payment_sent: "Payment sent",
  released: "Ready to receive",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
  disputed: "Disputed"
};

type TradeRow = Omit<Trade, "crypto_amount" | "fiat_amount" | "price_at_trade" | "my_role" | "payment_details"> & {
  crypto_amount: string;
  fiat_amount: string;
  price_at_trade: string;
  payment_details: string | null;
};

function parseDetails(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function generateRef(prefix: string): string {
  return `${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Returns all vendor user IDs owned by the given user (via owner_user_id column). */
export async function getOwnedVendorIds(userId: string): Promise<Set<string>> {
  await ensureDatabase();
  const rows = await dbQuery<{ id: string }>(
    `SELECT id::TEXT AS id FROM users WHERE owner_user_id = $1`,
    [userId]
  );
  return new Set(rows.map((r) => r.id));
}

const TRADE_SELECT = `
    SELECT t.id::TEXT AS id, t.ad_id::TEXT AS ad_id, t.trade_ref, t.payment_reference,
           t.receipt, t.receipt_image,
           t.crypto_currency, t.chain, t.crypto_amount::TEXT AS crypto_amount,
           t.fiat_currency, t.fiat_amount::TEXT AS fiat_amount,
           t.price_at_trade::TEXT AS price_at_trade,
           t.status, t.buyer_id, t.seller_id,
           t.buyer_paid_at, t.released_at, t.expires_at, t.created_at,
           t.escrow_locked_at, t.claimed_at,
           t.seller_wallet_address, t.buyer_wallet_address,
           buyer.name AS buyer_name, seller.name AS seller_name,
           pm.method_name AS payment_method_name, pm.method_type AS payment_method_type,
           pm.account_holder_name AS payment_account_holder, pm.details::TEXT AS payment_details,
           esc.status AS escrow_status, esc.debit_tx_hash AS escrow_debit_tx,
           esc.release_tx_hash AS escrow_release_tx, esc.claim_tx_hash AS escrow_claim_tx,
           esc.refund_tx_hash AS escrow_refund_tx, esc.release_to AS escrow_release_to
    FROM p2p_trades t
    JOIN users buyer ON buyer.id = t.buyer_id
    JOIN users seller ON seller.id = t.seller_id
    LEFT JOIN p2p_payment_methods pm ON pm.id = t.payment_method_id
    LEFT JOIN LATERAL (
      SELECT e.status, e.debit_tx_hash, e.release_tx_hash, e.claim_tx_hash,
             e.refund_tx_hash, e.release_to
      FROM p2p_escrow e WHERE e.trade_id = t.id ORDER BY e.id DESC LIMIT 1
    ) esc ON TRUE`;

function mapTrade(row: TradeRow, userId: string, ownedVendorIds?: Set<string>): Trade {
  const isOwnedVendor = (id: string) => ownedVendorIds?.has(id) ?? false;
  const myRole: "buyer" | "seller" =
    row.buyer_id === userId || isOwnedVendor(row.buyer_id) ? "buyer" : "seller";
  const { payment_details, ...rest } = row;
  return {
    ...rest,
    crypto_amount: toNumber(row.crypto_amount),
    fiat_amount: toNumber(row.fiat_amount),
    price_at_trade: toNumber(row.price_at_trade),
    payment_details: parseDetails(payment_details),
    my_role: myRole
  };
}

function isUserOrOwned(userId: string, targetId: string, ownedVendorIds?: Set<string>): boolean {
  return targetId === userId || (ownedVendorIds?.has(targetId) ?? false);
}

export async function createTrade(
  userId: string,
  input: { adId: string; cryptoAmount: number; paymentMethodId?: string | null; buyerWalletAddress?: string | null }
): Promise<Trade> {
  await ensureDatabase();

  const ads = await dbQuery<{
    id: string;
    user_id: string;
    ad_type: string;
    crypto_currency: string;
    fiat_currency: string;
    price_value: string;
    min_amount: string;
    max_amount: string;
  }>(
    `SELECT id::TEXT AS id, user_id, ad_type, crypto_currency, fiat_currency,
            price_value::TEXT AS price_value, min_amount::TEXT AS min_amount, max_amount::TEXT AS max_amount
     FROM p2p_ads WHERE id = $1 AND status = 'active' AND is_paused = FALSE`,
    [input.adId]
  );
  const ad = ads[0];
  if (!ad) throw new Error("Vendor is no longer available.");

  const price = toNumber(ad.price_value);
  const fiatAmount = input.cryptoAmount * price;

  if (fiatAmount < toNumber(ad.min_amount) || fiatAmount > toNumber(ad.max_amount)) {
    throw new Error("Amount is outside the vendor's limits.");
  }

  // Buy offer (ad_type 'sell') → vendor is the seller, initiator is the buyer.
  const buyerId = ad.ad_type === "sell" ? userId : ad.user_id;
  const sellerId = ad.ad_type === "sell" ? ad.user_id : userId;
  // On-chain escrow recipient (claims own'r wallet). For buy trades this is the
  // trader; for sell trades it's the vendor's saved wallet.
  const buyerWalletAddress = input.buyerWalletAddress?.trim() || null;

  const tradeRef = generateRef("TR");
  const paymentReference = generateRef("KW");

  const inserted = await dbQuery<{ id: string }>(
    `INSERT INTO p2p_trades (trade_ref, payment_reference, ad_id, buyer_id, seller_id,
        crypto_currency, chain, crypto_amount, fiat_currency, fiat_amount, price_at_trade,
        payment_method_id, buyer_wallet_address, status, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'avalanche', $7, $8, $9, $10, $11, $12, 'created', NOW() + INTERVAL '30 minutes')
     RETURNING id::TEXT AS id`,
    [tradeRef, paymentReference, ad.id, buyerId, sellerId, ad.crypto_currency, input.cryptoAmount, ad.fiat_currency, fiatAmount, price, input.paymentMethodId ?? null, buyerWalletAddress]
  );
  const tradeId = inserted[0].id;

  await dbQuery(
    `INSERT INTO p2p_escrow (trade_id, crypto_currency, chain, crypto_amount, status)
     VALUES ($1, $2, 'avalanche', $3, 'pending')`,
    [tradeId, ad.crypto_currency, input.cryptoAmount]
  );

  // Notify the counterparty — route to owner if it's an owned vendor
  const counterpartyId = sellerId === userId ? buyerId : sellerId;
  const counterpartySells = counterpartyId === sellerId;

  const users = await dbQuery<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [userId]);
  const initiatorName = users[0]?.name ?? "A user";

  const ownerRows = await dbQuery<{ owner_user_id: string | null }>(
    `SELECT owner_user_id FROM users WHERE id = $1`, [counterpartyId]
  );
  const notifyUserId = ownerRows[0]?.owner_user_id || counterpartyId;

  await createNotification(notifyUserId, {
    type: "trade_created",
    title: "New order request",
    body: `${initiatorName} wants to ${counterpartySells ? "buy" : "sell"} ${fmtCryptoAmount(Number(input.cryptoAmount))} ${ad.crypto_currency} with you. Approve the order to lock escrow.`,
    data: { tradeId }
  });

  const ownedVendorIds = await getOwnedVendorIds(userId);
  return getTrade(userId, tradeId, ownedVendorIds);
}

export async function getTrade(userId: string, tradeId: string, ownedVendorIds?: Set<string>): Promise<Trade> {
  await ensureDatabase();
  if (!ownedVendorIds) ownedVendorIds = await getOwnedVendorIds(userId);
  const allIds = [userId, ...Array.from(ownedVendorIds)];
  const rows = await dbQuery<TradeRow>(
    `${TRADE_SELECT} WHERE t.id = $1 AND (t.buyer_id = ANY($2) OR t.seller_id = ANY($2))`,
    [tradeId, allIds]
  );
  const row = rows[0];
  if (!row) throw new Error("Trade not found.");
  return mapTrade(row, userId, ownedVendorIds);
}

export async function listTrades(userId: string): Promise<Trade[]> {
  await ensureDatabase();
  const expired = await dbQuery<{ id: string }>(
    `UPDATE p2p_trades SET status = 'expired', updated_at = NOW()
     WHERE status IN ('created', 'escrow_locked') AND expires_at < NOW()
     RETURNING id`
  );
  for (const row of expired) await syncTradeNotification(row.id);
  const ownedVendorIds = await getOwnedVendorIds(userId);
  const allIds = [userId, ...Array.from(ownedVendorIds)];
  const rows = await dbQuery<TradeRow>(
    `${TRADE_SELECT} WHERE t.buyer_id = ANY($1) OR t.seller_id = ANY($1) ORDER BY t.created_at DESC`,
    [allIds]
  );
  return rows.map((row) => mapTrade(row, userId, ownedVendorIds));
}

export type TradeAction = "accept" | "mark_paid" | "release" | "claim" | "cancel" | "refund";

export type TradeActionInput = {
  receipt?: string;
  receiptImage?: string;
  walletAddress?: string;
  txHash?: string;
  destAddress?: string;
};

const ACTION_LABELS: Record<TradeAction, { title: string; body: (ref: string) => string }> = {
  accept: {
    title: "Order approved — escrow locked",
    body: (ref) => `Your order ${ref} was approved. The crypto is held in escrow — send your payment now.`
  },
  mark_paid: {
    title: "Payment receipt submitted",
    body: (ref) => `The buyer submitted a payment receipt for ${ref}. Review it and confirm the payment.`
  },
  release: {
    title: "Payment confirmed — crypto ready",
    body: (ref) => `The vendor confirmed your payment for ${ref}. Click Receive to get your crypto.`
  },
  claim: {
    title: "Trade completed",
    body: (ref) => `Trade ${ref} is complete. The buyer received the crypto.`
  },
  cancel: {
    title: "Order cancelled",
    body: (ref) => `Order ${ref} was cancelled.`
  },
  refund: {
    title: "Escrow refunded",
    body: (ref) => `The escrow for ${ref} was refunded to the seller.`
  }
};

export async function applyTradeAction(
  userId: string,
  tradeId: string,
  action: TradeAction,
  input: TradeActionInput = {}
): Promise<Trade> {
  await ensureDatabase();
  const ownedVendorIds = await getOwnedVendorIds(userId);
  const allIds = [userId, ...Array.from(ownedVendorIds)];
  const rows = await dbQuery<TradeRow>(
    `${TRADE_SELECT} WHERE t.id = $1 AND (t.buyer_id = ANY($2) OR t.seller_id = ANY($2))`,
    [tradeId, allIds]
  );
  const row = rows[0];
  if (!row) throw new Error("Trade not found.");

  const isBuyer = isUserOrOwned(userId, row.buyer_id, ownedVendorIds);
  const isSeller = isUserOrOwned(userId, row.seller_id, ownedVendorIds);
  const status = row.status;
  const escrowFunded = row.escrow_status === "funded";

  let newStatus = status;
  let escrowStatus: string | null = null;

  switch (action) {
    case "accept": {
      if (!isSeller) throw new Error("Only the seller can approve this order.");
      if (status !== "created") throw new Error("This order is no longer awaiting approval.");
      if (!input.walletAddress) throw new Error("Connect your wallet to approve and fund the escrow.");
      newStatus = "escrow_locked";
      escrowStatus = "funded";
      break;
    }
    case "mark_paid": {
      if (!isBuyer) throw new Error("Only the buyer can submit payment.");
      if (status !== "escrow_locked") throw new Error("Payment can only be submitted after the vendor funds the escrow.");
      newStatus = "payment_sent";
      break;
    }
    case "release": {
      if (!isSeller) throw new Error("Only the seller can confirm the payment.");
      if (status !== "payment_sent") throw new Error("There is no payment to confirm yet.");
      newStatus = "released";
      escrowStatus = "released";
      break;
    }
    case "claim": {
      if (!isBuyer) throw new Error("Only the buyer can receive the crypto.");
      if (status !== "released") throw new Error("The crypto is not ready to receive yet.");
      if (!input.destAddress) throw new Error("Choose where to receive the crypto.");
      newStatus = "completed";
      escrowStatus = "claimed";
      break;
    }
    case "cancel": {
      if (status !== "created" && status !== "escrow_locked") {
        throw new Error("This order can no longer be cancelled. The escrow must be refunded instead.");
      }
      newStatus = "cancelled";
      escrowStatus = escrowFunded ? null : "cancelled";
      break;
    }
    case "refund": {
      if (!isSeller) throw new Error("Only the seller can refund the escrow.");
      if (status !== "cancelled" && status !== "expired") {
        throw new Error("The escrow can only be refunded for a cancelled or expired order.");
      }
      if (!escrowFunded) throw new Error("The escrow has no funds to refund.");
      escrowStatus = "refunded";
      break;
    }
  }

  await dbQuery(
    `UPDATE p2p_trades SET
        status = $2,
        escrow_locked_at = CASE WHEN $2 = 'escrow_locked' THEN NOW() ELSE escrow_locked_at END,
        buyer_paid_at = CASE WHEN $2 = 'payment_sent' THEN NOW() ELSE buyer_paid_at END,
        released_at = CASE WHEN $2 = 'released' THEN NOW() ELSE released_at END,
        claimed_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE claimed_at END,
        cancelled_at = CASE WHEN $2 = 'cancelled' THEN NOW() ELSE cancelled_at END,
        seller_wallet_address = COALESCE($3, seller_wallet_address),
        receipt = COALESCE($4, receipt),
        receipt_image = COALESCE($5, receipt_image),
        updated_at = NOW()
      WHERE id = $1`,
    [tradeId, newStatus, input.walletAddress ?? null, input.receipt ?? null, input.receiptImage ?? null]
  );

  const escrowTx = input.txHash ?? null;
  if (escrowStatus) {
    await dbQuery(
      `UPDATE p2p_escrow SET
          status = $2,
          funded_at = COALESCE(funded_at, CASE WHEN $2 = 'funded' THEN NOW() END),
          debit_tx_hash = CASE WHEN $2 = 'funded' THEN COALESCE($3, debit_tx_hash) ELSE debit_tx_hash END,
          release_tx_hash = CASE WHEN $2 = 'released' THEN COALESCE($3, release_tx_hash) ELSE release_tx_hash END,
          claim_tx_hash = CASE WHEN $2 = 'claimed' THEN COALESCE($3, claim_tx_hash) ELSE claim_tx_hash END,
          refund_tx_hash = CASE WHEN $2 = 'refunded' THEN COALESCE($3, refund_tx_hash) ELSE refund_tx_hash END,
          release_to = CASE WHEN $2 = 'claimed' THEN COALESCE($4, release_to) ELSE release_to END,
          released_at = CASE WHEN $2 IN ('released', 'claimed') AND released_at IS NULL THEN NOW() ELSE released_at END
        WHERE trade_id = $1`,
      [tradeId, escrowStatus, escrowTx, input.destAddress ?? null]
    );
  }

  if (newStatus === "completed") {
    await dbQuery(
      `UPDATE users
       SET p2p_total_trades = p2p_total_trades + 1,
           p2p_completed_trades = p2p_completed_trades + 1,
           p2p_completion_rate_30d = ROUND((p2p_completed_trades + 1)::numeric / (p2p_total_trades + 1) * 100, 1),
           p2p_cumulative_counterparties = p2p_cumulative_counterparties + 1,
           updated_at = NOW()
       WHERE id = $2 OR id = $3`,
      [tradeId, row.buyer_id, row.seller_id]
    );
  }

  // Notify the counterparty — route to owner if it's an owned vendor
  const rawCounterpartyId = isBuyer ? row.seller_id : row.buyer_id;
  const label = ACTION_LABELS[action];

  const counterpartyRows = await dbQuery<{ owner_user_id: string | null }>(
    `SELECT owner_user_id FROM users WHERE id = $1`,
    [rawCounterpartyId]
  );
  const notifyUserId = counterpartyRows[0]?.owner_user_id || rawCounterpartyId;

  await createNotification(notifyUserId, {
    type: `trade_${action}`,
    title: label.title,
    body: label.body(row.trade_ref),
    data: { tradeId }
  });

  if (newStatus !== status) {
    await syncTradeNotification(tradeId);
  }

  return getTrade(userId, tradeId, ownedVendorIds);
}

/** Marks an expired-but-funded order as needing a refund once the seller refunds. */
export async function getEscrowForTrade(tradeId: string): Promise<{
  status: string | null;
  txHashes: { debit: string | null; release: string | null; claim: string | null; refund: string | null };
  releaseTo: string | null;
} | null> {
  await ensureDatabase();
  const rows = await dbQuery<{
    status: string | null;
    debit_tx_hash: string | null;
    release_tx_hash: string | null;
    claim_tx_hash: string | null;
    refund_tx_hash: string | null;
    release_to: string | null;
  }>(
    `SELECT status, debit_tx_hash, release_tx_hash, claim_tx_hash, refund_tx_hash, release_to
     FROM p2p_escrow WHERE trade_id = $1 ORDER BY id DESC LIMIT 1`,
    [tradeId]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    status: r.status,
    txHashes: {
      debit: r.debit_tx_hash,
      release: r.release_tx_hash,
      claim: r.claim_tx_hash,
      refund: r.refund_tx_hash
    },
    releaseTo: r.release_to
  };
}