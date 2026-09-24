import { randomBytes } from "crypto";
import { dbQuery, ensureDatabase } from "@/lib/db";
import { createNotification } from "@/lib/p2p/notifications";
import { getFees } from "@/lib/p2p/fees";
import { getLiveRate } from "@/lib/p2p/price-feed";
import { isAddress } from "viem";
import { isEscrowDeployed } from "@/lib/web3/escrow";
import { verifyEscrowTransaction, type EscrowVerificationAction } from "@/lib/p2p/chain-verification";
import { reconcileEscrowTrade } from "@/lib/p2p/reconciliation";

function fmtCryptoAmount(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Number(n.toFixed(6)).toLocaleString("en-US", { maximumFractionDigits: 6 });
}

type TradeActivityEvent = "approved" | "funded" | "payment_sent" | "released" | "completed" | "cancelled" | "declined" | "refunded";

async function createTradeActivity(tradeId: string, event: TradeActivityEvent, actorId: string, declineReason?: string): Promise<void> {
  const rows = await dbQuery<{
    trade_ref: string; buyer_id: string; seller_id: string; buyer_name: string; seller_name: string;
    vendor_id: string;
    buyer_owner_id: string | null; seller_owner_id: string | null; crypto_amount: string;
    crypto_currency: string; fiat_amount: string; fiat_currency: string; escrow_status: string | null;
  }>(
    `SELECT t.trade_ref, t.buyer_id, t.seller_id, ad.user_id AS vendor_id,
            buyer.name AS buyer_name, seller.name AS seller_name,
            buyer.owner_user_id AS buyer_owner_id, seller.owner_user_id AS seller_owner_id,
            t.crypto_amount::TEXT AS crypto_amount, t.crypto_currency,
            t.fiat_amount::TEXT AS fiat_amount, t.fiat_currency, escrow.status AS escrow_status
     FROM p2p_trades t
     JOIN p2p_ads ad ON ad.id = t.ad_id
     JOIN users buyer ON buyer.id = t.buyer_id
     JOIN users seller ON seller.id = t.seller_id
     LEFT JOIN LATERAL (
       SELECT status FROM p2p_escrow WHERE trade_id = t.id ORDER BY id DESC LIMIT 1
     ) escrow ON TRUE
     WHERE t.id = $1`,
    [tradeId]
  );
  const trade = rows[0];
  if (!trade) return;

  const crypto = `${fmtCryptoAmount(Number(trade.crypto_amount))} ${trade.crypto_currency}`;
  const fiat = `${fmtCryptoAmount(Number(trade.fiat_amount))} ${trade.fiat_currency}`;
  const buyerNotifyId = trade.buyer_owner_id || trade.buyer_id;
  const sellerNotifyId = trade.seller_owner_id || trade.seller_id;
  const actorName = actorId === trade.buyer_id ? trade.buyer_name : trade.seller_name;

  let buyer: { title: string; body: string };
  let seller: { title: string; body: string };
  switch (event) {
    case "approved":
      buyer = { title: "Sell order accepted", body: `You accepted ${trade.seller_name}'s order for ${crypto}. Waiting for them to fund escrow.` };
      seller = { title: "Vendor accepted your order", body: `${trade.buyer_name} confirmed they can send ${fiat}. You can now fund escrow.` };
      break;
    case "funded":
      buyer = { title: "Crypto secured in escrow", body: `${crypto} has been secured in escrow. You can now send ${fiat}.` };
      seller = { title: "Escrow funded", body: `You secured ${crypto} in escrow. Waiting for ${trade.buyer_name} to send ${fiat}.` };
      break;
    case "payment_sent":
      buyer = { title: "Payment submitted", body: `You marked the ${fiat} payment as sent. ${trade.seller_name} is reviewing it.` };
      seller = { title: "Payment marked as sent", body: `${trade.buyer_name} says the ${fiat} payment has been sent. Confirm it is in your account before releasing ${crypto}.` };
      break;
    case "released":
      if (trade.vendor_id === trade.buyer_id) {
        buyer = { title: "Crypto ready to receive", body: `${trade.seller_name} confirmed your payment. ${crypto} is ready to receive.` };
        seller = { title: "Trade completed successfully", body: `You confirmed ${trade.buyer_name}'s payment and released ${crypto} from escrow.` };
      } else {
        buyer = { title: "Payment confirmed", body: `${trade.seller_name} confirmed your payment. ${crypto} is ready to receive.` };
        seller = { title: "Crypto released", body: `You confirmed ${trade.buyer_name}'s payment and released ${crypto} from escrow.` };
      }
      break;
    case "completed":
      buyer = { title: "Trade completed", body: `You successfully bought ${crypto} from ${trade.seller_name}.` };
      seller = { title: "Trade completed", body: `You successfully sold ${crypto} to ${trade.buyer_name}.` };
      break;
    case "cancelled":
      buyer = actorId === trade.buyer_id
        ? { title: "Trade cancelled", body: `You cancelled your ${crypto} trade with ${trade.seller_name}.` }
        : { title: `Trade cancelled by ${actorName}`, body: `${actorName} cancelled the ${crypto} trade before it was completed.` };
      seller = actorId === trade.seller_id
        ? { title: "Trade cancelled", body: `You cancelled your ${crypto} trade with ${trade.buyer_name}.` }
        : { title: `Trade cancelled by ${actorName}`, body: `${actorName} cancelled the ${crypto} trade before it was completed.` };
      if (trade.escrow_status === "funded") {
        seller = { title: "Request your refund", body: `The trade was cancelled while ${crypto} remained in escrow. Open the trade to request your refund.` };
      }
      break;
    case "declined":
      buyer = actorId === trade.buyer_id
        ? { title: "Order declined", body: `You declined ${trade.seller_name}'s order for ${crypto}.` }
        : { title: "Order declined", body: `${trade.seller_name} declined your order for ${crypto}${declineReason ? `: ${declineReason}` : "."}` };
      seller = actorId === trade.seller_id
        ? { title: "Order declined", body: `You declined ${trade.buyer_name}'s order for ${crypto}.` }
        : { title: "Order declined", body: `${trade.buyer_name} declined your order for ${crypto}${declineReason ? `: ${declineReason}` : "."}` };
      break;
    case "refunded":
      buyer = { title: "Trade refunded", body: `The cancelled trade is closed and ${crypto} was returned to the crypto seller.` };
      seller = { title: "Refund received", body: `${crypto} was returned to your wallet from escrow.` };
      break;
  }

  await Promise.allSettled([
    createNotification(buyerNotifyId, { type: `trade_${event}`, ...buyer, data: { tradeId } }),
    createNotification(sellerNotifyId, { type: `trade_${event}`, ...seller, data: { tradeId } })
  ]);
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
  fee_rate: number;
  release_hold_minutes: number;
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
  decline_feedback: string | null;
  declined_at: string | null;
  inventory_confirmed_at: string | null;
  buyer_closed_at: string | null;
  seller_wallet_address: string | null;
  buyer_wallet_address: string | null;
  escrow_status: string | null;
  escrow_debit_tx: string | null;
  escrow_payment_tx: string | null;
  escrow_release_tx: string | null;
  escrow_claim_tx: string | null;
  escrow_refund_tx: string | null;
  escrow_release_to: string | null;
  initiator_id: string;
  is_initiator: boolean;
  my_role: "buyer" | "seller";
  can_act_as_buyer: boolean;
  can_act_as_seller: boolean;
};

export type TradeStatus =
  | "created" // submitted, awaiting vendor approval
  | "approved" // sell order accepted by fiat-paying vendor; crypto seller must fund
  | "escrow_locked" // crypto funded on-chain; buyer to pay fiat
  | "payment_sent" // buyer uploaded receipt
  | "released" // seller confirmed fiat received; buyer can claim
  | "completed" // buyer claimed crypto
  | "declined" // receiving counterparty rejected the unfunded order
  | "cancelled"
  | "expired"
  | "disputed"
  | "reconciliation_required";

export const ACTIVE_TRADE_STATUSES: TradeStatus[] = ["created", "approved", "escrow_locked", "payment_sent", "released", "disputed", "reconciliation_required"];

/** A cancelled/expired trade remains financially active until funded escrow is refunded. */
export function isActiveTrade(trade: Pick<Trade, "status" | "escrow_status" | "my_role" | "buyer_closed_at">): boolean {
  if (trade.status === "pending_payment" || ACTIVE_TRADE_STATUSES.includes(trade.status as TradeStatus)) return true;
  const awaitingRefund = (trade.status === "cancelled" || trade.status === "expired") && trade.escrow_status === "funded";
  return awaitingRefund && !(trade.my_role === "buyer" && trade.buyer_closed_at);
}

export const TRADE_STATUS_LABELS: Record<string, string> = {
  created: "Awaiting approval",
  approved: "Accepted — deposit crypto",
  escrow_locked: "Crypto secured — pay now",
  payment_sent: "Payment sent",
  released: "Ready to receive",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
  expired: "Expired",
  disputed: "Disputed",
  reconciliation_required: "Needs reconciliation"
};

type TradeRow = Omit<Trade, "crypto_amount" | "fiat_amount" | "price_at_trade" | "fee_rate" | "release_hold_minutes" | "my_role" | "is_initiator" | "payment_details"> & {
  crypto_amount: string;
  fiat_amount: string;
  price_at_trade: string;
  fee_rate: string;
  release_hold_minutes: string;
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
           t.fee_rate::TEXT AS fee_rate,
           t.release_hold_minutes::TEXT AS release_hold_minutes,
           t.status, t.buyer_id, t.seller_id,
           CASE WHEN t.buyer_id = ad.user_id THEN t.seller_id ELSE t.buyer_id END AS initiator_id,
           t.buyer_paid_at, t.released_at, t.expires_at, t.created_at,
           t.escrow_locked_at, t.claimed_at, t.decline_feedback, t.declined_at, t.inventory_confirmed_at, t.buyer_closed_at,
           t.seller_wallet_address, t.buyer_wallet_address,
           buyer.name AS buyer_name, seller.name AS seller_name,
           pm.method_name AS payment_method_name, pm.method_type AS payment_method_type,
           pm.account_holder_name AS payment_account_holder, pm.details::TEXT AS payment_details,
           esc.status AS escrow_status, esc.debit_tx_hash AS escrow_debit_tx,
           esc.payment_tx_hash AS escrow_payment_tx,
           esc.release_tx_hash AS escrow_release_tx, esc.claim_tx_hash AS escrow_claim_tx,
           esc.refund_tx_hash AS escrow_refund_tx, esc.release_to AS escrow_release_to
    FROM p2p_trades t
    JOIN p2p_ads ad ON ad.id = t.ad_id
    JOIN users buyer ON buyer.id = t.buyer_id
    JOIN users seller ON seller.id = t.seller_id
    LEFT JOIN p2p_payment_methods pm ON pm.id = t.payment_method_id
    LEFT JOIN LATERAL (
      SELECT e.status, e.debit_tx_hash, e.payment_tx_hash, e.release_tx_hash, e.claim_tx_hash,
             e.refund_tx_hash, e.release_to
      FROM p2p_escrow e WHERE e.trade_id = t.id ORDER BY e.id DESC LIMIT 1
    ) esc ON TRUE`;

function mapTrade(row: TradeRow, userId: string, ownedVendorIds?: Set<string>, isSuperAdmin = false): Trade {
  const isOwnedVendor = (id: string) => ownedVendorIds?.has(id) ?? false;
  const myRole: "buyer" | "seller" =
    row.buyer_id === userId || isOwnedVendor(row.buyer_id) ? "buyer" : "seller";
  const canActAsBuyer = isUserOrOwned(userId, row.buyer_id, ownedVendorIds) || isSuperAdmin;
  const canActAsSeller = isUserOrOwned(userId, row.seller_id, ownedVendorIds) || isSuperAdmin;
  const isInitiator = isUserOrOwned(userId, row.initiator_id, ownedVendorIds);
  const { payment_details, ...rest } = row;
  return {
    ...rest,
    crypto_amount: toNumber(row.crypto_amount),
    fiat_amount: toNumber(row.fiat_amount),
    price_at_trade: toNumber(row.price_at_trade),
    fee_rate: toNumber(row.fee_rate),
    release_hold_minutes: toNumber(row.release_hold_minutes),
    payment_details: parseDetails(payment_details),
    is_initiator: isInitiator,
    my_role: myRole,
    can_act_as_buyer: canActAsBuyer,
    can_act_as_seller: canActAsSeller
  };
}

function isUserOrOwned(userId: string, targetId: string, ownedVendorIds?: Set<string>): boolean {
  return targetId === userId || (ownedVendorIds?.has(targetId) ?? false);
}

async function applySavedBuyerWallets(tradeId?: string): Promise<void> {
  await dbQuery(
    `UPDATE p2p_trades t
     SET buyer_wallet_address = (
       SELECT w.wallet_address
       FROM p2p_user_wallets w
       WHERE w.user_id = t.buyer_id AND w.chain = 'avalanche'
       ORDER BY w.is_primary DESC, w.created_at DESC
       LIMIT 1
     ), updated_at = NOW()
     WHERE t.status = 'created'
       AND t.buyer_wallet_address IS NULL
       AND ($1::TEXT IS NULL OR t.id::TEXT = $1::TEXT)
       AND EXISTS (
         SELECT 1 FROM p2p_user_wallets w
         WHERE w.user_id = t.buyer_id AND w.chain = 'avalanche'
       )`,
    [tradeId ?? null]
  );
}

export async function createTrade(
  userId: string,
  input: { adId: string; cryptoAmount: number; paymentMethodId?: string | null; buyerWalletAddress?: string | null },
  isSuperAdmin = false
): Promise<Trade> {
  await ensureDatabase();

  const ads = await dbQuery<{
    id: string;
    user_id: string;
    ad_type: string;
    crypto_currency: string;
    fiat_currency: string;
    price_type: string;
    price_value: string;
    price_margin: string | null;
    min_amount: string;
    max_amount: string;
    vendor_fee_percent: string;
    effective_vendor_id: string;
  }>(
    `SELECT a.id::TEXT AS id, a.user_id, a.ad_type, a.crypto_currency, a.fiat_currency,
            a.price_type, a.price_value::TEXT AS price_value, a.price_margin::TEXT AS price_margin,
            a.min_amount::TEXT AS min_amount, a.max_amount::TEXT AS max_amount,
            CASE WHEN a.ad_type = 'sell' THEN COALESCE(owner.vendor_sell_fee_percent, u.vendor_sell_fee_percent, u.vendor_fee_percent, owner.vendor_fee_percent)
                 ELSE COALESCE(owner.vendor_buy_fee_percent, u.vendor_buy_fee_percent, u.vendor_fee_percent, owner.vendor_fee_percent)
            END::TEXT AS vendor_fee_percent,
            COALESCE(u.owner_user_id, u.id)::TEXT AS effective_vendor_id
     FROM p2p_ads a
     JOIN users u ON u.id = a.user_id
     LEFT JOIN users owner ON owner.id = u.owner_user_id
     WHERE a.id = $1 AND a.status = 'active' AND a.is_paused = FALSE
       AND u.p2p_advertiser_status <> 'none'`,
    [input.adId]
  );
  const ad = ads[0];
  if (!ad) throw new Error("Vendor is no longer available.");

  const viewerRows = await dbQuery<{ effective_user_id: string }>(
    `SELECT COALESCE(owner_user_id, id)::TEXT AS effective_user_id FROM users WHERE id = $1`,
    [userId]
  );
  if ((viewerRows[0]?.effective_user_id ?? userId) === ad.effective_vendor_id) {
    throw new Error("You cannot open a trade with your own vendor listing.");
  }

  const vendorFee = Number(ad.vendor_fee_percent) || 0;
  const standardRate = await getLiveRate(ad.crypto_currency, ad.fiat_currency);
  const direction = ad.ad_type === "sell" ? 1 : -1;
  const price = Number((standardRate * (1 + (direction * vendorFee) / 100)).toFixed(2));
  const fiatAmount = input.cryptoAmount * price;

  if (fiatAmount < toNumber(ad.min_amount) || fiatAmount > toNumber(ad.max_amount)) {
    throw new Error("Amount is outside the vendor's limits.");
  }

  const fees = await getFees(ad.crypto_currency, ad.fiat_currency);
  const feeRate = fees.takerFee;

  // Buy offer (ad_type 'sell') → vendor is the seller, initiator is the buyer.
  const buyerId = ad.ad_type === "sell" ? userId : ad.user_id;
  const sellerId = ad.ad_type === "sell" ? ad.user_id : userId;
  // On-chain escrow recipient (claims own'r wallet). For buy trades this is the
  // trader; for sell trades it's the vendor's saved wallet.
  let buyerWalletAddress = input.buyerWalletAddress?.trim() || null;
  if (!buyerWalletAddress) {
    const savedWallets = await dbQuery<{ wallet_address: string }>(
      `SELECT wallet_address FROM p2p_user_wallets
       WHERE user_id = $1 AND chain = 'avalanche'
       ORDER BY is_primary DESC, created_at DESC LIMIT 1`,
      [buyerId]
    );
    buyerWalletAddress = savedWallets[0]?.wallet_address ?? null;
  }
  if (buyerWalletAddress && !isAddress(buyerWalletAddress)) {
    throw new Error("The receive wallet address is invalid.");
  }

  const tradeRef = generateRef("TR");
  const paymentReference = generateRef("KW");

  const inserted = await dbQuery<{ id: string }>(
    `INSERT INTO p2p_trades (trade_ref, payment_reference, ad_id, buyer_id, seller_id,
        crypto_currency, chain, crypto_amount, fiat_currency, fiat_amount, price_at_trade,
        fee_rate, release_hold_minutes, payment_method_id, buyer_wallet_address, status, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'avalanche', $7, $8, $9, $10, $11, $12, $13, $14, 'created', NOW() + INTERVAL '2 hours')
     RETURNING id::TEXT AS id`,
    [tradeRef, paymentReference, ad.id, buyerId, sellerId, ad.crypto_currency, input.cryptoAmount, ad.fiat_currency, fiatAmount, price, feeRate, 0, input.paymentMethodId ?? null, buyerWalletAddress]
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

  const crypto = `${fmtCryptoAmount(Number(input.cryptoAmount))} ${ad.crypto_currency}`;
  const fiat = `${fmtCryptoAmount(fiatAmount)} ${ad.fiat_currency}`;
  const counterpartyNameRows = await dbQuery<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [counterpartyId]);
  const counterpartyName = counterpartyNameRows[0]?.name ?? "the vendor";

  await Promise.allSettled([
    createNotification(notifyUserId, {
      type: "trade_created",
      title: counterpartySells ? "New buy order" : "New sell order",
      body: counterpartySells
        ? `${initiatorName} wants to buy ${crypto} for ${fiat}. Review the order and fund escrow if you can fulfill it.`
        : `${initiatorName} wants to sell ${crypto} for ${fiat}. Confirm that you can make the payment before accepting the order.`,
      data: { tradeId }
    }),
    createNotification(userId, {
      type: "trade_created",
      title: counterpartySells ? "Buy order sent" : "Sell order sent",
      body: counterpartySells
        ? `Your order to buy ${crypto} from ${counterpartyName} has been submitted.`
        : `Your order to sell ${crypto} to ${counterpartyName} has been submitted.`,
      data: { tradeId }
    })
  ]);

  const ownedVendorIds = await getOwnedVendorIds(userId);
  return getTrade(userId, tradeId, ownedVendorIds, isSuperAdmin);
}

export async function getTrade(userId: string, tradeId: string, ownedVendorIds?: Set<string>, isSuperAdmin = false): Promise<Trade> {
  await ensureDatabase();
  await applySavedBuyerWallets(tradeId);
  if (isEscrowDeployed()) {
    await reconcileEscrowTrade(tradeId).catch((error) => {
      console.error("On-demand escrow reconciliation failed", { tradeId, error: error instanceof Error ? error.message : "unknown" });
    });
  }
  if (!ownedVendorIds) ownedVendorIds = await getOwnedVendorIds(userId);
  const allIds = [userId, ...Array.from(ownedVendorIds)];
  const rows = await dbQuery<TradeRow>(
    `${TRADE_SELECT} WHERE t.id = $1 AND (t.buyer_id = ANY($2) OR t.seller_id = ANY($2))`,
    [tradeId, allIds]
  );
  const row = rows[0];
  if (!row) throw new Error("Trade not found.");
  return mapTrade(row, userId, ownedVendorIds, isSuperAdmin);
}

export async function listTrades(userId: string, isSuperAdmin = false): Promise<Trade[]> {
  await ensureDatabase();
  await applySavedBuyerWallets();
  const ownedVendorIds = await getOwnedVendorIds(userId);
  const allIds = [userId, ...Array.from(ownedVendorIds)];
  const rows = await dbQuery<TradeRow>(
    `${TRADE_SELECT} WHERE t.buyer_id = ANY($1) OR t.seller_id = ANY($1) ORDER BY t.created_at DESC`,
    [allIds]
  );
  return rows.map((row) => mapTrade(row, userId, ownedVendorIds, isSuperAdmin));
}

export type TradeAction = "set_receive_wallet" | "approve" | "accept" | "mark_paid" | "release" | "claim" | "cancel" | "refund" | "close_trade" | "decline";

export type TradeActionInput = {
  actionRequestId?: string;
  receipt?: string;
  receiptImage?: string;
  walletAddress?: string;
  txHash?: string;
  destAddress?: string;
  declineFeedback?: string;
};

const ESCROW_ACTIONS = new Set<TradeAction>(["accept", "mark_paid", "release", "claim", "refund"]);

function assertEscrowMutationInput(action: TradeAction, input: TradeActionInput) {
  if (!ESCROW_ACTIONS.has(action)) return;

  const txHash = input.txHash?.trim();
  const realEscrow = isEscrowDeployed();
  if (realEscrow && txHash && !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    throw new Error("The wallet transaction hash is invalid.");
  }

  if (input.walletAddress && !isAddress(input.walletAddress.trim())) {
    throw new Error("The connected wallet address is invalid.");
  }
  if (input.destAddress && !isAddress(input.destAddress.trim())) {
    throw new Error("The receive wallet address is invalid.");
  }

  if (realEscrow && !txHash) {
    throw new Error("A confirmed wallet transaction is required.");
  }
}

export async function applyTradeAction(
  userId: string,
  tradeId: string,
  action: TradeAction,
  input: TradeActionInput = {},
  isSuperAdmin = false
): Promise<Trade> {
  await ensureDatabase();
  await applySavedBuyerWallets(tradeId);
  if (isEscrowDeployed()) await reconcileEscrowTrade(tradeId);
  assertEscrowMutationInput(action, input);
  const ownedVendorIds = await getOwnedVendorIds(userId);
  const allIds = [userId, ...Array.from(ownedVendorIds)];
  const rows = await dbQuery<TradeRow>(
    `${TRADE_SELECT} WHERE t.id = $1 AND (t.buyer_id = ANY($2) OR t.seller_id = ANY($2))`,
    [tradeId, allIds]
  );
  const row = rows[0];
  if (!row) throw new Error("Trade not found.");

  const isBuyer = isUserOrOwned(userId, row.buyer_id, ownedVendorIds) || isSuperAdmin;
  const isSeller = isUserOrOwned(userId, row.seller_id, ownedVendorIds) || isSuperAdmin;
  const isInitiator = isUserOrOwned(userId, row.initiator_id, ownedVendorIds);
  const status = row.status;
  const escrowFunded = row.escrow_status === "funded";

  let chainVerification: { blockNumber: bigint; logIndex: number } | null = null;
  if (isEscrowDeployed() && ESCROW_ACTIONS.has(action)) {
    if (action === "accept" && !row.buyer_wallet_address) {
      throw new Error("The buyer must set a receive wallet before the crypto can be secured.");
    }
    chainVerification = await verifyEscrowTransaction({
      action: action as EscrowVerificationAction,
      txHash: input.txHash!,
      tradeRef: row.trade_ref,
      cryptoCurrency: row.crypto_currency,
      cryptoAmount: toNumber(row.crypto_amount),
      buyerWalletAddress: row.buyer_wallet_address,
      sellerWalletAddress: action === "accept" ? input.walletAddress ?? null : row.seller_wallet_address,
      destinationAddress: input.destAddress
    });
  }

  let newStatus = status;
  let escrowStatus: string | null = null;

  switch (action) {
    case "set_receive_wallet": {
      if (!isBuyer) throw new Error("Only the buyer can choose the receiving wallet.");
      if (status !== "created") throw new Error("The receiving wallet can no longer be changed for this order.");
      if (!input.destAddress?.trim() || !isAddress(input.destAddress.trim())) {
        throw new Error("The receive wallet address is invalid.");
      }
      break;
    }
    case "approve": {
      if (!isBuyer || isInitiator) throw new Error("Only the fiat-paying vendor can accept this sell order.");
      if (status !== "created") throw new Error("This order is no longer awaiting acceptance.");
      if (!row.buyer_wallet_address) throw new Error("Choose a receiving wallet before accepting this sell order.");
      newStatus = "approved";
      break;
    }
    case "accept": {
      if (!isSeller) throw new Error("Only the crypto seller can deposit the crypto.");
      const canFundBuyOrder = !isInitiator && status === "created";
      const canFundSellOrder = isInitiator && status === "approved";
      if (!canFundBuyOrder && !canFundSellOrder) {
        throw new Error(isInitiator
          ? "Wait for the fiat-paying vendor to accept this sell order before depositing the crypto."
          : "This order is no longer awaiting a crypto deposit.");
      }
      if (!input.walletAddress) throw new Error("Connect your wallet to deposit the crypto.");
      newStatus = "escrow_locked";
      escrowStatus = "funded";
      break;
    }
    case "mark_paid": {
      if (!isBuyer) throw new Error("Only the buyer can submit payment.");
      const protectingCancelledPayment = (status === "cancelled" || status === "expired") && escrowFunded;
      if (status !== "escrow_locked" && !protectingCancelledPayment) {
        throw new Error("Payment can only be submitted while the crypto is still secured.");
      }
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
      newStatus = "completed";
      escrowStatus = "claimed";
      break;
    }
    case "cancel": {
      if (!isInitiator) throw new Error("Only the person who started this trade can cancel it.");
      if (status === "payment_sent") {
        throw new Error("The buyer has marked this trade paid. Confirm receipt or open a dispute; it cannot be cancelled.");
      }
      if (status !== "created" && status !== "approved" && status !== "escrow_locked") {
        throw new Error("This order can no longer be cancelled.");
      }
      newStatus = "cancelled";
      escrowStatus = escrowFunded ? null : "cancelled";
      break;
    }
    case "refund": {
      if (!isSeller) throw new Error("Only the seller can request a refund.");
      if (status !== "cancelled" && status !== "expired") {
        throw new Error("A refund is only available for a cancelled or expired order.");
      }
      if (!escrowFunded) throw new Error("There is nothing to refund.");
      escrowStatus = "refunded";
      break;
    }
    case "close_trade": {
      if (!isBuyer) throw new Error("Only the fiat-paying buyer can close this cancelled trade.");
      if (status !== "cancelled" && status !== "expired") {
        throw new Error("Only a cancelled trade can be closed this way.");
      }
      if (!escrowFunded) throw new Error("This trade is already closed.");
      break;
    }
    case "decline": {
      if (isInitiator) throw new Error("The person who started this trade can cancel it, but cannot decline it.");
      if (!isBuyer && !isSeller) throw new Error("Only the receiving party can decline this order.");
      if (status !== "created") throw new Error("This order is no longer awaiting approval.");
      if (!input.declineFeedback?.trim()) throw new Error("Please provide a reason for declining the order.");
      newStatus = "declined";
      break;
    }
  }

  const requestId = input.actionRequestId?.trim();
  if (requestId) {
    if (!/^[A-Za-z0-9._:-]{8,120}$/.test(requestId)) {
      throw new Error("The action request identifier is invalid.");
    }
    const requestRows = await dbQuery<{ id: string }>(
      `INSERT INTO p2p_trade_action_requests (trade_id, user_id, action, request_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (trade_id, user_id, action, request_id) DO NOTHING
       RETURNING id`,
      [tradeId, userId, action, requestId]
    );
    if (requestRows.length === 0) return getTrade(userId, tradeId, ownedVendorIds, isSuperAdmin);
  }

  const updatedTradeRows = await dbQuery<{ id: string }>(
    `UPDATE p2p_trades SET
        status = $2,
        escrow_locked_at = CASE WHEN $2 = 'escrow_locked' THEN NOW() ELSE escrow_locked_at END,
        buyer_paid_at = CASE WHEN $2 = 'payment_sent' THEN NOW() ELSE buyer_paid_at END,
        released_at = CASE WHEN $2 = 'released' THEN NOW() ELSE released_at END,
        claimed_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE claimed_at END,
        cancelled_at = CASE WHEN $2 = 'cancelled' THEN NOW() ELSE cancelled_at END,
        seller_wallet_address = COALESCE($3, seller_wallet_address),
        buyer_wallet_address = CASE WHEN $7 = 'set_receive_wallet' THEN $8 ELSE buyer_wallet_address END,
        receipt = COALESCE($4, receipt),
        receipt_image = COALESCE($5, receipt_image),
        declined_at = CASE WHEN $7 = 'decline' THEN NOW() ELSE declined_at END,
        decline_feedback = CASE WHEN $7 = 'decline' THEN $6
                                ELSE decline_feedback END,
        buyer_closed_at = CASE WHEN $7 = 'close_trade' THEN NOW() ELSE buyer_closed_at END,
        updated_at = NOW()
      WHERE id = $1 AND status = $9
      RETURNING id`,
    [tradeId, newStatus, input.walletAddress ?? null, input.receipt ?? null, input.receiptImage ?? null, input.declineFeedback ?? null, action, input.destAddress?.trim() ?? null, status]
  );
  if (updatedTradeRows.length === 0) {
    throw new Error("This trade changed while you were acting. Refresh and try again.");
  }

  const escrowTx = input.txHash ?? null;
  if (action === "mark_paid") {
    await dbQuery(
      `UPDATE p2p_escrow SET
          payment_tx_hash = COALESCE($2, payment_tx_hash),
          chain_block_number = $3::NUMERIC,
          chain_log_index = $4::INTEGER,
          chain_verified_at = CASE WHEN $3::NUMERIC IS NOT NULL THEN NOW() ELSE NULL END,
          chain_verifier_version = CASE WHEN $3::NUMERIC IS NOT NULL THEN 'escrow-events-v2' ELSE NULL END
       WHERE trade_id = $1`,
      [tradeId, escrowTx, chainVerification?.blockNumber.toString() ?? null, chainVerification?.logIndex ?? null]
    );
  }
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
          released_at = CASE WHEN $2 IN ('released', 'claimed') AND released_at IS NULL THEN NOW() ELSE released_at END,
          chain_block_number = $5::NUMERIC,
          chain_log_index = $6::INTEGER,
          chain_verified_at = CASE WHEN $5::NUMERIC IS NOT NULL THEN NOW() ELSE NULL END,
          chain_verifier_version = CASE WHEN $5::NUMERIC IS NOT NULL THEN 'escrow-events-v2' ELSE NULL END
        WHERE trade_id = $1`,
      [tradeId, escrowStatus, escrowTx, input.destAddress ?? null, chainVerification?.blockNumber.toString() ?? null, chainVerification?.logIndex ?? null]
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
       WHERE id = $1 OR id = $2`,
      [row.buyer_id, row.seller_id]
    );
  }

  // Auto-decrement the seller's declared inventory when a trade completes.
  if (newStatus === "completed" && row.seller_id !== row.initiator_id) {
    await dbQuery(
      `UPDATE p2p_vendor_inventory
       SET declared_balance = GREATEST(declared_balance - $3::numeric, 0),
           updated_at = NOW()
       WHERE user_id = COALESCE(
         (SELECT u.owner_user_id
          FROM users u
          JOIN p2p_vendor_inventory shared
            ON shared.user_id = u.owner_user_id AND shared.crypto_currency = $2
          WHERE u.id = $1),
         $1
       )
         AND crypto_currency = $2`,
      [row.seller_id, row.crypto_currency, toNumber(row.crypto_amount)]
    );
  }

  const activityByAction: Partial<Record<TradeAction, { event: TradeActivityEvent; actorId: string }>> = {
    approve: { event: "approved", actorId: row.buyer_id },
    accept: { event: "funded", actorId: row.seller_id },
    mark_paid: { event: "payment_sent", actorId: row.buyer_id },
    release: { event: "released", actorId: row.seller_id },
    claim: { event: "completed", actorId: row.buyer_id },
    cancel: { event: "cancelled", actorId: row.initiator_id },
    decline: {
      event: "declined",
      actorId: row.buyer_id === row.initiator_id ? row.seller_id : row.buyer_id
    },
    refund: { event: "refunded", actorId: row.seller_id }
  };
  const activity = activityByAction[action];
  if (activity) {
    await createTradeActivity(tradeId, activity.event, activity.actorId, input.declineFeedback);
  }

  return getTrade(userId, tradeId, ownedVendorIds, isSuperAdmin);
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

/**
 * Vendor confirms the absolute remaining balance after a completed trade.
 * Sets the vendor's declared inventory to the reported balance and stamps
 * `inventory_confirmed_at` on the trade. Only the seller of a completed trade
 * can do this.
 */
export async function confirmInventory(userId: string, tradeId: string, declaredBalance: number): Promise<Trade> {
  await ensureDatabase();
  const ownedVendorIds = await getOwnedVendorIds(userId);
  const allIds = [userId, ...Array.from(ownedVendorIds)];
  const rows = await dbQuery<TradeRow>(
    `${TRADE_SELECT} WHERE t.id = $1 AND (t.buyer_id = ANY($2) OR t.seller_id = ANY($2))`,
    [tradeId, allIds]
  );
  const row = rows[0];
  if (!row) throw new Error("Trade not found.");

  const isSeller = isUserOrOwned(userId, row.seller_id, ownedVendorIds);
  if (!isSeller) throw new Error("Only the vendor can confirm inventory.");
  if (row.seller_id === row.initiator_id) throw new Error("Customer sell orders do not use vendor inventory confirmation.");
  if (row.status !== "completed") throw new Error("Inventory can only be confirmed after the trade completes.");

  await dbQuery(
    `INSERT INTO p2p_vendor_inventory (user_id, crypto_currency, declared_balance, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, crypto_currency)
     DO UPDATE SET declared_balance = $3, updated_at = NOW()`,
    [(await dbQuery<{ inventory_owner_id: string }>(
      `SELECT COALESCE(owner_user_id, id)::TEXT AS inventory_owner_id FROM users WHERE id = $1`,
      [row.seller_id]
    ))[0]?.inventory_owner_id ?? row.seller_id, row.crypto_currency, declaredBalance]
  );

  await dbQuery(
    `UPDATE p2p_trades SET inventory_confirmed_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [tradeId]
  );

  return getTrade(userId, tradeId, ownedVendorIds);
}
