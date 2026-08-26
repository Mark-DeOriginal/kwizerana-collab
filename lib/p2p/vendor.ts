import { dbQuery, ensureDatabase } from "@/lib/db";

export type VendorStatus = {
  isVendor: boolean;
  advertiserStatus: string;
  advertiserLevel: string;
  verifiedTier: string;
  availableCrypto: number;
  availableFiat: number;
};

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function getVendorStatus(userId: string): Promise<VendorStatus> {
  await ensureDatabase();
  const rows = await dbQuery<Record<string, unknown>>(
    `SELECT p2p_advertiser_status, p2p_advertiser_level, p2p_verified_tier,
            p2p_available_crypto, p2p_available_fiat
     FROM users WHERE id = $1`,
    [userId]
  );
  const r = rows[0] ?? {};

  const ownStatus = String(r.p2p_advertiser_status ?? "none");

  // If user already is a vendor, return directly
  if (ownStatus !== "none") {
    return {
      isVendor: true,
      advertiserStatus: ownStatus,
      advertiserLevel: String(r.p2p_advertiser_level ?? "none"),
      verifiedTier: String(r.p2p_verified_tier ?? "none"),
      availableCrypto: toNumber(r.p2p_available_crypto),
      availableFiat: toNumber(r.p2p_available_fiat)
    };
  }

  // Check if user owns any vendor accounts (e.g. admin owns Kwizerana DAO)
  const ownedRows = await dbQuery<Record<string, unknown>>(
    `SELECT SUM(p2p_available_crypto)::NUMERIC AS total_crypto,
            SUM(p2p_available_fiat)::NUMERIC AS total_fiat,
            MAX(p2p_advertiser_status) AS best_status,
            MAX(p2p_advertiser_level) AS best_level,
            MAX(p2p_verified_tier) AS best_tier
     FROM users WHERE owner_user_id = $1`,
    [userId]
  );
  const owned = ownedRows[0];
  if (owned && owned.best_status) {
    return {
      isVendor: true,
      advertiserStatus: String(owned.best_status),
      advertiserLevel: String(owned.best_level ?? "general"),
      verifiedTier: String(owned.best_tier ?? "none"),
      availableCrypto: toNumber(owned.total_crypto),
      availableFiat: toNumber(owned.total_fiat)
    };
  }

  return {
    isVendor: false,
    advertiserStatus: ownStatus,
    advertiserLevel: String(r.p2p_advertiser_level ?? "none"),
    verifiedTier: String(r.p2p_verified_tier ?? "none"),
    availableCrypto: toNumber(r.p2p_available_crypto),
    availableFiat: toNumber(r.p2p_available_fiat)
  };
}

export type BecomeVendorInput = {
  cryptoAvailable: number;
  fiatAvailable: number;
  rate: number;
  paymentMethodIds: string[];
};

export async function becomeVendor(userId: string, input: BecomeVendorInput): Promise<void> {
  await ensureDatabase();

  const fiatCurrency = "USD";
  const sellPrice = Number(input.rate.toFixed(2));
  const buyPrice = Number((input.rate * 0.99).toFixed(2));
  const sellMax = Math.round(input.cryptoAvailable * input.rate);
  const buyMax = Math.round(input.fiatAvailable);

  await dbQuery(
    `UPDATE users
     SET p2p_advertiser_status = 'general',
         p2p_advertiser_level = 'beginner',
         p2p_available_crypto = $2,
         p2p_available_fiat = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [userId, input.cryptoAvailable, input.fiatAvailable]
  );

  const existingAds = await dbQuery<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count FROM p2p_ads WHERE user_id = $1`,
    [userId]
  );

  if (Number(existingAds[0]?.count ?? "0") > 0) return;

  const pmIds = input.paymentMethodIds;

  for (const adType of ["sell", "buy"] as const) {
    const price = adType === "sell" ? sellPrice : buyPrice;
    const max = adType === "sell" ? sellMax : buyMax;
    await dbQuery(
      `INSERT INTO p2p_ads (user_id, ad_type, crypto_currency, chain, fiat_currency, price_type, price_value, min_amount, max_amount, payment_method_ids, status)
       VALUES ($1, $2, 'USDT', 'avalanche', $3, 'fixed', $4, 50, $5, $6::bigint[], 'active')`,
      [userId, adType, fiatCurrency, price, max, pmIds]
    );
  }
}
