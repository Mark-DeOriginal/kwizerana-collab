import { dbQuery, ensureDatabase } from "@/lib/db";

export type OfferVendor = {
  id: string;
  name: string;
  advertiserStatus: string;
  advertiserLevel: string;
  verifiedTier: string;
  completionRate: number;
  totalTrades: number;
  avgReleaseSeconds: number;
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
  p2p_advertiser_status: string;
  p2p_advertiser_level: string;
  p2p_verified_tier: string;
  p2p_completion_rate_30d: string;
  p2p_total_trades: string;
  p2p_avg_release_seconds: string;
};

export async function listOffers({ side, asset, fiat }: OfferFilters): Promise<Offer[]> {
  await ensureDatabase();

  // Buy tab lists sellers (ad_type 'sell'); Sell tab lists buyers (ad_type 'buy').
  const adType = side === "buy" ? "sell" : "buy";

  const rows = await dbQuery<AdRow>(
    `SELECT a.id::TEXT AS id, a.ad_type, a.crypto_currency, a.fiat_currency, a.price_type,
            a.price_value::TEXT AS price_value, a.price_margin::TEXT AS price_margin,
            a.min_amount::TEXT AS min_amount, a.max_amount::TEXT AS max_amount,
            u.id AS vendor_id, u.name AS vendor_name,
            u.p2p_advertiser_status, u.p2p_advertiser_level, u.p2p_verified_tier,
            u.p2p_completion_rate_30d, u.p2p_total_trades, u.p2p_avg_release_seconds
     FROM p2p_ads a
     JOIN users u ON u.id = a.user_id
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

  const offers: Offer[] = rows.map((row) => ({
    id: row.id,
    ad_type: row.ad_type as "buy" | "sell",
    crypto_currency: row.crypto_currency,
    fiat_currency: row.fiat_currency,
    price_type: row.price_type,
    price_value: Number(row.price_value),
    price_margin: row.price_margin == null ? null : Number(row.price_margin),
    min_amount: Number(row.min_amount),
    max_amount: Number(row.max_amount),
    vendor: {
      id: row.vendor_id,
      name: row.vendor_name,
      advertiserStatus: row.p2p_advertiser_status,
      advertiserLevel: row.p2p_advertiser_level,
      verifiedTier: row.p2p_verified_tier,
      completionRate: Number(row.p2p_completion_rate_30d),
      totalTrades: Number(row.p2p_total_trades),
      avgReleaseSeconds: Number(row.p2p_avg_release_seconds)
    },
    payment_methods: methodsByVendor.get(row.vendor_id) ?? []
  }));

  offers.sort((a, b) =>
    side === "buy" ? a.price_value - b.price_value : b.price_value - a.price_value
  );

  return offers;
}
