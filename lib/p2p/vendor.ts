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

export type VendorClosureResult =
  | { ok: true }
  | { ok: false; reason: "not_vendor" | "managed_account" | "active_trades" | "open_disputes"; count?: number };

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

export async function closeVendorAccount(userId: string): Promise<VendorClosureResult> {
  await ensureDatabase();
  const rows = await dbQuery<{
    advertiser_status: string;
    owner_user_id: string | null;
    owned_count: string;
    active_trade_count: string;
    open_dispute_count: string;
  }>(
    `SELECT u.p2p_advertiser_status AS advertiser_status,
            u.owner_user_id,
            (SELECT COUNT(*)::TEXT FROM users child WHERE child.owner_user_id = u.id) AS owned_count,
            (SELECT COUNT(DISTINCT t.id)::TEXT
             FROM p2p_trades t
             WHERE (t.buyer_id = u.id OR t.seller_id = u.id)
               AND (
                 t.status IN ('created', 'approved', 'escrow_locked', 'pending_payment', 'payment_sent', 'released', 'disputed', 'reconciliation_required')
                 OR EXISTS (SELECT 1 FROM p2p_escrow e WHERE e.trade_id = t.id AND e.status = 'funded')
               )) AS active_trade_count,
            (SELECT COUNT(DISTINCT d.id)::TEXT
             FROM p2p_disputes d
             JOIN p2p_trades t ON t.id = d.trade_id
             WHERE (t.buyer_id = u.id OR t.seller_id = u.id)
               AND d.status NOT IN ('resolved', 'closed')) AS open_dispute_count
     FROM users u
     WHERE u.id = $1`,
    [userId]
  );
  const account = rows[0];
  if (!account || account.advertiser_status === "none") return { ok: false, reason: "not_vendor" };
  if (account.owner_user_id || Number(account.owned_count) > 0 || userId.startsWith("kwizerana-dao-")) {
    return { ok: false, reason: "managed_account" };
  }
  if (Number(account.open_dispute_count) > 0) {
    return { ok: false, reason: "open_disputes", count: Number(account.open_dispute_count) };
  }
  if (Number(account.active_trade_count) > 0) {
    return { ok: false, reason: "active_trades", count: Number(account.active_trade_count) };
  }

  const closed = await dbQuery<{ id: string }>(
    `WITH eligible AS (
       SELECT u.id
       FROM users u
       WHERE u.id = $1
         AND u.p2p_advertiser_status <> 'none'
         AND u.owner_user_id IS NULL
         AND u.id NOT LIKE 'kwizerana-dao-%'
         AND NOT EXISTS (SELECT 1 FROM users child WHERE child.owner_user_id = u.id)
         AND NOT EXISTS (
           SELECT 1 FROM p2p_trades t
           WHERE (t.buyer_id = u.id OR t.seller_id = u.id)
             AND (
               t.status IN ('created', 'approved', 'escrow_locked', 'pending_payment', 'payment_sent', 'released', 'disputed', 'reconciliation_required')
               OR EXISTS (SELECT 1 FROM p2p_escrow e WHERE e.trade_id = t.id AND e.status = 'funded')
             )
         )
         AND NOT EXISTS (
           SELECT 1 FROM p2p_disputes d
           JOIN p2p_trades t ON t.id = d.trade_id
           WHERE (t.buyer_id = u.id OR t.seller_id = u.id)
             AND d.status NOT IN ('resolved', 'closed')
         )
       FOR UPDATE
     ), closed_user AS (
       UPDATE users
       SET p2p_advertiser_status = 'none', p2p_is_online = FALSE, updated_at = NOW()
       WHERE id IN (SELECT id FROM eligible)
       RETURNING id
     ), closed_ads AS (
       UPDATE p2p_ads
       SET status = 'inactive', is_paused = TRUE, updated_at = NOW()
       WHERE user_id IN (SELECT id FROM closed_user)
       RETURNING id
     ), closed_applications AS (
       UPDATE p2p_advertiser_applications
       SET status = 'withdrawn', reviewed_at = NOW()
       WHERE user_id IN (SELECT id FROM closed_user) AND status = 'approved'
       RETURNING id
     )
     SELECT id::TEXT AS id FROM closed_user`,
    [userId]
  );
  return closed.length > 0 ? { ok: true } : { ok: false, reason: "active_trades" };
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

export async function getEffectiveVendorInventory(
  ownerId: string,
  managedVendors: ManagedVendor[]
): Promise<VendorInventoryEntry[]> {
  const shared = await getVendorInventory(ownerId);
  if (shared.length > 0 || managedVendors.length === 0) return shared;

  const rows = await dbQuery<{ crypto_currency: string; declared_balance: string; updated_at: string | null }>(
    `SELECT crypto_currency,
            MAX(declared_balance)::TEXT AS declared_balance,
            MAX(updated_at) AS updated_at
     FROM p2p_vendor_inventory
     WHERE user_id = ANY($1)
     GROUP BY crypto_currency
     ORDER BY crypto_currency ASC`,
    [managedVendors.map((vendor) => vendor.id)]
  );
  return rows.map((row) => ({
    crypto_currency: row.crypto_currency,
    declared_balance: toNumber(row.declared_balance),
    updated_at: row.updated_at
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
 * Resolve the inventory/fee owner for an account. Managed vendor profiles use
 * their owner's single pool so one wallet balance cannot be counted once per
 * storefront. Standalone vendors continue to own their own pool.
 */
export async function resolveInventoryTarget(
  userId: string,
  _requestedId?: string | null
): Promise<{ targetId: string; managedVendors: ManagedVendor[] }> {
  await ensureDatabase();
  const ownedRows = await dbQuery<{ id: string; name: string }>(
    `SELECT id::TEXT AS id, name FROM users WHERE owner_user_id = $1 ORDER BY name ASC`,
    [userId]
  );
  const managedVendors = ownedRows.map((r) => ({ id: r.id, name: r.name }));
  const ownerRows = await dbQuery<{ owner_user_id: string | null }>(
    `SELECT owner_user_id FROM users WHERE id = $1`,
    [userId]
  );
  return { targetId: ownerRows[0]?.owner_user_id ?? userId, managedVendors };
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

  if (Number(existingAds[0]?.count ?? "0") > 0) {
    await dbQuery(
      `UPDATE p2p_ads
       SET status = 'active', is_paused = FALSE, payment_method_ids = $2::bigint[], updated_at = NOW()
       WHERE user_id = $1 AND crypto_currency = 'USDT' AND fiat_currency = 'USD'`,
      [userId, input.paymentMethodIds]
    );
    return;
  }

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

      await dbQuery(
        `UPDATE p2p_ads
         SET status = 'active', is_paused = FALSE,
             payment_method_ids = CASE WHEN cardinality($4::bigint[]) > 0 THEN $4::bigint[] ELSE payment_method_ids END,
             updated_at = NOW()
         WHERE user_id = $1 AND crypto_currency = $2 AND fiat_currency = $3`,
        [userId, crypto, fiat, pmIds]
      );

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
