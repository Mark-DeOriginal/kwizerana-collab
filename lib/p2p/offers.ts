import { dbQuery, ensureDatabase } from "@/lib/db";
import { listAllFees } from "@/lib/p2p/fees";
import { listLiveRates } from "@/lib/p2p/price-feed";
import { SEED_RATES } from "@/lib/p2p/currencies-shared";

export type OfferVendor = {
  id: string;
  name: string;
  advertiserStatus: string;
  advertiserLevel: string;
  verifiedTier: string;
  completionRate: number;
  totalTrades: number;
  avgReleaseSeconds: number;
  // Vendor-declared balance of the offer's token available for sale.
  balance: number;
  // Minimum floor for the displayed limit.
  limitMin: number;
  // Vendor's custom fee percentage applied on top of the standard rate.
  vendorFeePercent: number;
};

export type OfferPaymentMethod = {
  id: string;
  method_type: string;
  method_name: string;
};

export type Offer = {
  id: string;
  ad_type: "buy" | "sell";
  crypto_currency: string;
  fiat_currency: string;
  price_type: string;
  price_value: number;
  price_margin: number | null;
  min_amount: number;
  max_amount: number;
  takerFeeRate: number;
  vendor: OfferVendor;
  payment_methods: OfferPaymentMethod[];
};

export type OfferFilters = {
  side: "buy" | "sell";
  asset: string;
  fiat: string;
};

type AdRow = {
  id: string;
  ad_type: string;
  crypto_currency: string;
  fiat_currency: string;
  price_type: string;
  price_value: string;
  price_margin: string | null;
  min_amount: string;
  max_amount: string;
  vendor_id: string;
  vendor_name: string;
  vendor_fee_percent: string;
  p2p_advertiser_status: string;
  p2p_advertiser_level: string;
  p2p_verified_tier: string;
  p2p_completion_rate_30d: string;
  p2p_total_trades: string;
  p2p_avg_release_seconds: string;
  declared_balance: string | null;
};

// The minimum floor for a listing's displayed limit.
export const CRYPTO_LIMIT_MIN = 10;

export async function listOffers({ side, asset, fiat }: OfferFilters): Promise<Offer[]> {
  await ensureDatabase();

  // Buy tab lists sellers (ad_type 'sell'); Sell tab lists buyers (ad_type 'buy').
  const adType = side === "buy" ? "sell" : "buy";

  const rows = await dbQuery<AdRow>(
    `SELECT a.id::TEXT AS id, a.ad_type, a.crypto_currency, a.fiat_currency, a.price_type,
            a.price_value::TEXT AS price_value, a.price_margin::TEXT AS price_margin,
            a.min_amount::TEXT AS min_amount, a.max_amount::TEXT AS max_amount,
            u.id AS vendor_id, u.name AS vendor_name,
            CASE WHEN a.ad_type = 'sell' THEN COALESCE(u.vendor_sell_fee_percent, u.vendor_fee_percent)
                 ELSE COALESCE(u.vendor_buy_fee_percent, u.vendor_fee_percent)
            END::TEXT AS vendor_fee_percent,
            u.p2p_advertiser_status, u.p2p_advertiser_level, u.p2p_verified_tier,
            u.p2p_completion_rate_30d, u.p2p_total_trades, u.p2p_avg_release_seconds,
            inv.declared_balance::TEXT AS declared_balance
     FROM p2p_ads a
     JOIN users u ON u.id = a.user_id
     LEFT JOIN p2p_vendor_inventory inv ON inv.user_id = a.user_id AND inv.crypto_currency = a.crypto_currency
     WHERE a.status = 'active' AND a.is_paused = FALSE
       AND a.ad_type = $1 AND a.crypto_currency = $2 AND a.fiat_currency = $3`,
    [adType, asset, fiat]
  );

  // The vendor's receiving options are ALL of their saved payment methods.
  const vendorIds = Array.from(new Set(rows.map((row) => row.vendor_id)));

  const methodsByVendor = new Map<string, OfferPaymentMethod[]>();
  if (vendorIds.length > 0) {
    const pmRows = await dbQuery<OfferPaymentMethod & { user_id: string }>(
      `SELECT id::TEXT AS id, user_id, method_type, method_name
       FROM p2p_payment_methods
       WHERE user_id = ANY($1)
       ORDER BY id ASC`,
      [vendorIds]
    );
    for (const pm of pmRows) {
      const list = methodsByVendor.get(pm.user_id) ?? [];
      list.push({ id: pm.id, method_type: pm.method_type, method_name: pm.method_name });
      methodsByVendor.set(pm.user_id, list);
    }
  }

  const fees = await listAllFees();
  const liveRates = await listLiveRates();

  const offers: Offer[] = rows.map((row) => {
    const declared = row.declared_balance == null ? 0 : Number(row.declared_balance);
    const vendorFee = Number(row.vendor_fee_percent) || 0;
    const standardRate = liveRates[`${row.crypto_currency}:${row.fiat_currency}`] ?? SEED_RATES[row.fiat_currency] ?? Number(row.price_value);
    // Sell ads: vendor sells at standard rate + fee (higher price for buyer)
    // Buy ads: vendor buys at standard rate - fee (lower price for seller)
    const direction = row.ad_type === "sell" ? 1 : -1;
    const price = Number((standardRate * (1 + (direction * vendorFee) / 100)).toFixed(2));
    const fee = fees[`${row.crypto_currency}:${row.fiat_currency}`];

    return {
      id: row.id,
      ad_type: row.ad_type as "buy" | "sell",
      crypto_currency: row.crypto_currency,
      fiat_currency: row.fiat_currency,
      price_type: row.price_type,
      price_value: price,
      price_margin: vendorFee,
      min_amount: Number(row.min_amount),
      max_amount: Number(row.max_amount),
      takerFeeRate: fee?.takerFee ?? 0,
      vendor: {
        id: row.vendor_id,
        name: row.vendor_name,
        advertiserStatus: row.p2p_advertiser_status,
        advertiserLevel: row.p2p_advertiser_level,
        verifiedTier: row.p2p_verified_tier,
        completionRate: Number(row.p2p_completion_rate_30d),
        totalTrades: Number(row.p2p_total_trades),
        avgReleaseSeconds: Number(row.p2p_avg_release_seconds),
        balance: declared,
        limitMin: CRYPTO_LIMIT_MIN,
        vendorFeePercent: vendorFee
      },
      payment_methods: methodsByVendor.get(row.vendor_id) ?? []
    };
  });

  // Only show listings whose vendor has a >0 declared balance for that token.
  // Per-token gating: each token's ads are gated by that token's declared amount.
  const visible = offers.filter((o) => o.vendor.balance > 0);

  visible.sort((a, b) =>
    side === "buy" ? a.price_value - b.price_value : b.price_value - a.price_value
  );

  return visible;
}
