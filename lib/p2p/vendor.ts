import { dbQuery, ensureDatabase } from "@/lib/db";
import { SEED_RATES } from "@/lib/p2p/currencies-shared";

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

export type VendorInventoryEntry = {
  crypto_currency: string;
  declared_balance: number;
  updated_at: string | null;
};

export async function getVendorInventory(userId: string): Promise<VendorInventoryEntry[]> {
  await ensureDatabase();
  const rows = await dbQuery<{ crypto_currency: string; declared_balance: string; updated_at: string | null }>(
    `SELECT crypto_currency, declared_balance::TEXT AS declared_balance, updated_at
     FROM p2p_vendor_inventory
     WHERE user_id = $1
     ORDER BY crypto_currency ASC`,
    [userId]
  );
  return rows.map((r) => ({
    crypto_currency: r.crypto_currency,
    declared_balance: toNumber(r.declared_balance),
    updated_at: r.updated_at
  }));
}

export async function upsertVendorInventory(
  userId: string,
  cryptoCurrency: string,
  declaredBalance: number
): Promise<void> {
  await ensureDatabase();
  await dbQuery(
    `INSERT INTO p2p_vendor_inventory (user_id, crypto_currency, declared_balance, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, crypto_currency)
     DO UPDATE SET declared_balance = $3, updated_at = NOW()`,
    [userId, cryptoCurrency, declaredBalance]
  );
}

export type ManagedVendor = {
  id: string;
  name: string;
};

/**
 * Resolve which vendor account inventory should be read/written for.
 * - A user who is themself a vendor manages their own account (or an owned one if explicitly requested).
 * - A user who owns vendor accounts (e.g. the DAO admin) manages one of those; `requestedId`
 *   selects which, otherwise the first owned vendor is the default.
 */
export async function resolveInventoryTarget(
  userId: string,
  requestedId?: string | null
): Promise<{ targetId: string; managedVendors: ManagedVendor[] }> {
  await ensureDatabase();
  const ownedRows = await dbQuery<{ id: string; name: string }>(
    `SELECT id::TEXT AS id, name FROM users WHERE owner_user_id = $1 ORDER BY name ASC`,
    [userId]
  );
  const managedVendors = ownedRows.map((r) => ({ id: r.id, name: r.name }));
  const ownedIds = new Set(managedVendors.map((v) => v.id));

  const selfRows = await dbQuery<{ status: string }>(
    `SELECT p2p_advertiser_status::TEXT AS status FROM users WHERE id = $1`,
    [userId]
  );
  const ownStatus = selfRows[0]?.status ?? "none";

  if (ownStatus !== "none") {
    const targetId = requestedId && ownedIds.has(requestedId) ? requestedId : userId;
    return { targetId, managedVendors };
  }

  if (requestedId) {
    if (ownedIds.has(requestedId)) return { targetId: requestedId, managedVendors };
    if (requestedId === userId) return { targetId: requestedId, managedVendors };
  }

  return { targetId: managedVendors[0]?.id ?? userId, managedVendors };
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

  // Seed declared inventory so listings are visible once the vendor is created.
  await dbQuery(
    `INSERT INTO p2p_vendor_inventory (user_id, crypto_currency, declared_balance, updated_at)
     VALUES ($1, 'USDT', $2, NOW())
     ON CONFLICT (user_id, crypto_currency) DO NOTHING`,
    [userId, input.cryptoAvailable]
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

export type ProvisionVendorListingsInput = {
  cryptoCurrencies: string[];
  fiatCurrencies: string[];
  paymentMethodIds: string[];
};

/**
 * Create sell + buy ads for a vendor across the crypto/fiat pairs they selected,
 * skipping pairs that already have ads. Used on vendor approval so a freshly
 * accepted vendor actually appears on the trade page once they declare inventory.
 */
export async function provisionVendorListings(userId: string, input: ProvisionVendorListingsInput): Promise<void> {
  await ensureDatabase();
  const pmIds = input.paymentMethodIds.filter(Boolean);
  const cryptos = input.cryptoCurrencies.length > 0 ? input.cryptoCurrencies : ["USDT"];
  const fiats = input.fiatCurrencies.length > 0 ? input.fiatCurrencies : ["USD"];

  for (const crypto of cryptos) {
    for (const fiat of fiats) {
      const rate = SEED_RATES[fiat] ?? 1;
      const sellPrice = Number((rate * 1.01).toFixed(2));
      const buyPrice = Number((rate * 0.99).toFixed(2));
      const minAmount = Math.round(rate * 50);
      const maxAmount = Math.round(rate * 100000);

      const existing = await dbQuery<{ sell: string; buy: string }>(
        `SELECT COUNT(*) FILTER (WHERE ad_type = 'sell')::TEXT AS sell,
                COUNT(*) FILTER (WHERE ad_type = 'buy')::TEXT AS buy
         FROM p2p_ads WHERE user_id = $1 AND crypto_currency = $2 AND fiat_currency = $3`,
        [userId, crypto, fiat]
      );
      const hasSell = Number(existing[0]?.sell ?? "0") > 0;
      const hasBuy = Number(existing[0]?.buy ?? "0") > 0;

      if (!hasSell) {
        await dbQuery(
          `INSERT INTO p2p_ads (user_id, ad_type, crypto_currency, chain, fiat_currency, price_type, price_value, min_amount, max_amount, payment_method_ids, status)
           VALUES ($1, 'sell', $2, 'avalanche', $3, 'fixed', $4, $5, $6, $7::bigint[], 'active')`,
          [userId, crypto, fiat, sellPrice, minAmount, maxAmount, pmIds]
        );
      }
      if (!hasBuy) {
        await dbQuery(
          `INSERT INTO p2p_ads (user_id, ad_type, crypto_currency, chain, fiat_currency, price_type, price_value, min_amount, max_amount, payment_method_ids, status)
           VALUES ($1, 'buy', $2, 'avalanche', $3, 'fixed', $4, $5, $6, $7::bigint[], 'active')`,
          [userId, crypto, fiat, buyPrice, minAmount, maxAmount, pmIds]
        );
      }
    }
  }
}

/**
 * Make sure a vendor has listings for the currencies they applied with.
 * Reads their latest approved application; if none, defaults to USDT/USD.
 * Idempotent — safe to call on approval and again whenever the vendor
 * updates inventory, so a vendor always appears on the trade page as soon
 * as they declare a balance.
 */
export async function ensureVendorListings(userId: string): Promise<void> {
  await ensureDatabase();

  const apps = await dbQuery<{ details: string }>(
    `SELECT details::TEXT AS details
     FROM p2p_advertiser_applications
     WHERE user_id = $1 AND status = 'approved'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  let cryptoCurrencies = ["USDT"];
  let fiatCurrencies = ["USD"];
  let paymentMethodIds: string[] = [];

  if (apps[0]) {
    try {
      const d = JSON.parse(apps[0].details) as {
        cryptoCurrencies?: unknown;
        fiatCurrencies?: unknown;
        paymentMethodIds?: unknown;
      };
      if (Array.isArray(d.cryptoCurrencies) && d.cryptoCurrencies.length > 0) {
        cryptoCurrencies = d.cryptoCurrencies.map(String);
      }
      if (Array.isArray(d.fiatCurrencies) && d.fiatCurrencies.length > 0) {
        fiatCurrencies = d.fiatCurrencies.map(String);
      }
      if (Array.isArray(d.paymentMethodIds)) {
        paymentMethodIds = d.paymentMethodIds.map(String);
      }
    } catch {
      // ignore malformed details
    }
  }

  await provisionVendorListings(userId, { cryptoCurrencies, fiatCurrencies, paymentMethodIds });
}
