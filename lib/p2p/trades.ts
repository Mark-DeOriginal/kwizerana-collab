import { randomBytes } from "crypto";
import { dbQuery, ensureDatabase } from "@/lib/db";
import { createNotification } from "@/lib/p2p/notifications";

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
  my_role: "buyer" | "seller";
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
  SELECT t.id::TEXT AS id, t.ad_id::TEXT AS ad_id, t.trade_ref, t.payment_reference, t.receipt, t.receipt_image,
         t.crypto_currency, t.chain, t.crypto_amount::TEXT AS crypto_amount,
         t.fiat_currency, t.fiat_amount::TEXT AS fiat_amount, t.price_at_trade::TEXT AS price_at_trade,
         t.status, t.buyer_id, t.seller_id, t.buyer_paid_at, t.released_at, t.expires_at, t.created_at,
         buyer.name AS buyer_name, seller.name AS seller_name,
         pm.method_name AS payment_method_name, pm.method_type AS payment_method_type,
         pm.account_holder_name AS payment_account_holder, pm.details::TEXT AS payment_details
  FROM p2p_trades t
  JOIN users buyer ON buyer.id = t.buyer_id
  JOIN users seller ON seller.id = t.seller_id
  LEFT JOIN p2p_payment_methods pm ON pm.id = t.payment_method_id`;

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
  input: { adId: string; cryptoAmount: number; paymentMethodId?: string | null }
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

  const tradeRef = generateRef("TR");
  const paymentReference = generateRef("KW");

  const inserted = await dbQuery<{ id: string }>(
    `INSERT INTO p2p_trades (trade_ref, payment_reference, ad_id, buyer_id, seller_id,
        crypto_currency, chain, crypto_amount, fiat_currency, fiat_amount, price_at_trade,
        payment_method_id, status, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'avalanche', $7, $8, $9, $10, $11, 'created', NOW() + INTERVAL '30 minutes')
     RETURNING id::TEXT AS id`,
    [tradeRef, paymentReference, ad.id, buyerId, sellerId, ad.crypto_currency, input.cryptoAmount, ad.fiat_currency, fiatAmount, price, input.paymentMethodId ?? null]
  );
  const tradeId = inserted[0].id;

  await dbQuery(
    `INSERT INTO p2p_escrow (trade_id, crypto_currency, chain, crypto_amount, status)
     VALUES ($1, $2, 'avalanche', $3, 'locked')`,
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
    title: "New trade request",
    body: `${initiatorName} wants to ${counterpartySells ? "buy" : "sell"} ${input.cryptoAmount} ${ad.crypto_currency} with you.`,
    data: { tradeId }
  });

  const ownedVendorIds = await getOwnedVendorIds(userId);
  return getTrade(userId, tradeId, ownedVendorIds);
}

export async function getTrade(userId: string, tradeId: string, ownedVendorIds?: Set<string>): Promise<Trade> {
  await ensureDatabase();
  if (!ownedVendorIds) ownedVendorIds = await getOwnedVendorIds(userId);
  const allIds = [userId, ...ownedVendorIds];
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
  await dbQuery(
    `UPDATE p2p_trades SET status = 'expired', updated_at = NOW()
     WHERE status IN ('created', 'pending_payment') AND expires_at < NOW()`
  );
  const ownedVendorIds = await getOwnedVendorIds(userId);
  const allIds = [userId, ...ownedVendorIds];
  const rows = await dbQuery<TradeRow>(
    `${TRADE_SELECT} WHERE t.buyer_id = ANY($1) OR t.seller_id = ANY($1) ORDER BY t.created_at DESC`,
    [allIds]
  );
  return rows.map((row) => mapTrade(row, userId, ownedVendorIds));
}

export type TradeAction = "lock" | "mark_paid" | "release" | "cancel";

export async function applyTradeAction(
  userId: string,
  tradeId: string,
  action: TradeAction,
  receipt?: string,
  receiptImage?: string
): Promise<Trade> {
  await ensureDatabase();
  const ownedVendorIds = await getOwnedVendorIds(userId);
  const allIds = [userId, ...ownedVendorIds];
  const rows = await dbQuery<TradeRow>(
    `${TRADE_SELECT} WHERE t.id = $1 AND (t.buyer_id = ANY($2) OR t.seller_id = ANY($2))`,
    [tradeId, allIds]
  );
  const row = rows[0];
  if (!row) throw new Error("Trade not found.");

  const isBuyer = isUserOrOwned(userId, row.buyer_id, ownedVendorIds);
  const isSeller = isUserOrOwned(userId, row.seller_id, ownedVendorIds);
  const status = row.status;

  let newStatus = status;

  if (action === "lock") {
    if (!isSeller || status !== "created") throw new Error("Only the seller can lock escrow at this stage.");
    newStatus = "pending_payment";
  } else if (action === "mark_paid") {
    if (!isBuyer || (status !== "created" && status !== "pending_payment")) {
      throw new Error("Only the buyer can mark payment at this stage.");
    }
    newStatus = "payment_sent";
  } else if (action === "release") {
    if (!isSeller || status !== "payment_sent") throw new Error("Only the seller can release funds at this stage.");
    newStatus = "completed";
  } else if (action === "cancel") {
    if (status !== "created" && status !== "pending_payment") {
      throw new Error("This trade can no longer be cancelled.");
    }
    newStatus = "cancelled";
  }

  const now = "NOW()";

  await dbQuery(
    `UPDATE p2p_trades SET
       status = $2,
       buyer_paid_at = CASE WHEN $3 = 'payment_sent' THEN ${now} ELSE buyer_paid_at END,
       released_at = CASE WHEN $3 = 'completed' THEN ${now} ELSE released_at END,
       cancelled_at = CASE WHEN $3 = 'cancelled' THEN ${now} ELSE cancelled_at END,
       receipt = COALESCE($4, receipt),
       receipt_image = COALESCE($5, receipt_image),
       updated_at = ${now}
     WHERE id = $1`,
    [tradeId, newStatus, newStatus, receipt ?? null, receiptImage ?? null]
  );

  if (newStatus === "completed") {
    await dbQuery(
      `UPDATE p2p_escrow SET status = 'released', released_at = NOW() WHERE trade_id = $1`,
      [tradeId]
    );
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
  const actionLabel =
    action === "lock"
      ? "locked the escrow"
      : action === "mark_paid"
        ? "marked payment as sent"
        : action === "release"
          ? "released your crypto"
          : "cancelled the trade";

  const counterpartyRows = await dbQuery<{ owner_user_id: string | null }>(
    `SELECT owner_user_id FROM users WHERE id = $1`,
    [rawCounterpartyId]
  );
  const notifyUserId = counterpartyRows[0]?.owner_user_id || rawCounterpartyId;

  await createNotification(notifyUserId, {
    type: `trade_${action}`,
    title: "Trade updated",
    body: `${row[isBuyer ? "buyer_name" : "seller_name"]} ${actionLabel} (${row.trade_ref}).`,
    data: { tradeId }
  });

  return getTrade(userId, tradeId, ownedVendorIds);
}
