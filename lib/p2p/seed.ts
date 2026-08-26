import { dbQuery, ensureDatabase } from "@/lib/db";
import { CRYPTO_CURRENCIES, FIAT_CURRENCIES, SEED_RATES } from "@/lib/p2p/currencies-shared";
import { SUPPORTED_METHODS } from "@/lib/p2p/payment-methods-shared";
import { getCurrencyMethods } from "@/lib/p2p/countries-shared";
import { getAdminEmails } from "@/lib/roles";

declare global {
  var __p2pSeeded: Promise<void> | undefined;
}

async function seedP2PData(): Promise<void> {
  for (const c of FIAT_CURRENCIES) {
    await dbQuery(
      `INSERT INTO p2p_currencies (code, name, region, is_fiat)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (code) DO NOTHING`,
      [c.code, c.name, c.region]
    );
  }

  for (const code of CRYPTO_CURRENCIES) {
    await dbQuery(
      `INSERT INTO p2p_currencies (code, name, region, is_fiat)
       VALUES ($1, $2, 'Crypto', FALSE)
       ON CONFLICT (code) DO NOTHING`,
      [code, code]
    );
  }

  for (const fiatCode of Object.keys(SEED_RATES)) {
    for (const crypto of CRYPTO_CURRENCIES) {
      await dbQuery(
        `INSERT INTO p2p_currency_rates (crypto_currency, fiat_currency, rate)
         VALUES ($1, $2, $3)
         ON CONFLICT (crypto_currency, fiat_currency) DO NOTHING`,
        [crypto, fiatCode, SEED_RATES[fiatCode]]
      );
    }
  }

  for (const m of SUPPORTED_METHODS) {
    await dbQuery(
      `INSERT INTO p2p_supported_methods (slug, name, category, risk_level, hold_period_minutes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (slug) DO NOTHING`,
      [m.slug, m.name, m.category, m.risk_level, m.hold_period_minutes]
    );
  }

  await seedDefaultVendors();
}

// ── Kwizerana DAO — one market-making vendor per fiat currency ──────────────
function seedAccountIdentifier(category: string, code: string): string {
  const hash = (code.charCodeAt(0) * 7919 + code.length * 97) % 900000000;
  if (category === "digital_wallet") return `dao.${code.toLowerCase()}@kwizerana.xyz`;
  if (category === "mobile_money") return `+${100000000 + hash}`;
  return `${1000000000 + hash}`;
}

async function seedDefaultVendors(): Promise<void> {
  // Remove the legacy single-vendor seed (replaced by per-currency vendors).
  await dbQuery(`DELETE FROM users WHERE id = 'kwizerana-dao-vendor'`);

  // Find the main admin user to link DAO vendors as owners
  const adminEmails = getAdminEmails();
  let adminUserId: string | null = null;
  if (adminEmails.length > 0) {
    const adminRows = await dbQuery<{ id: string }>(
      `SELECT id::TEXT AS id FROM users WHERE email = $1 LIMIT 1`,
      [adminEmails[0]]
    );
    adminUserId = adminRows[0]?.id ?? null;
  }

  for (const c of FIAT_CURRENCIES) {
    const code = c.code;
    const vendorId = `kwizerana-dao-${code.toLowerCase()}`;
    const vendorName = `Kwizerana DAO - ${code}`;
    const email = `dao-${code.toLowerCase()}@kwizerana.xyz`;
    const rate = SEED_RATES[code] ?? 1;

    await dbQuery(
      `INSERT INTO users (id, email, name, role, email_verified, owner_user_id,
          p2p_advertiser_status, p2p_advertiser_level, p2p_verified_tier,
          p2p_completion_rate_30d, p2p_total_trades, p2p_completed_trades,
          p2p_cumulative_counterparties, p2p_volume_30d, p2p_avg_release_seconds, p2p_trust_score)
       VALUES ($1, $2, $3, 'member', TRUE, $4, 'verified', 'veteran', 'gold', 100, 5000, 5000, 1000, 5000000, 120, 100)
       ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           email_verified = TRUE,
           owner_user_id = COALESCE(EXCLUDED.owner_user_id, users.owner_user_id),
           p2p_advertiser_status = 'verified',
           p2p_advertiser_level = 'veteran',
           p2p_verified_tier = 'gold'`,
      [vendorId, email, vendorName, adminUserId]
    );

    let pmRows = await dbQuery<{ id: string; method_type: string; method_name: string; details: string }>(
      `SELECT id::TEXT AS id, method_type, method_name, details::TEXT AS details
       FROM p2p_payment_methods WHERE user_id = $1 ORDER BY id ASC`,
      [vendorId]
    );

    if (pmRows.length === 0) {
      for (const m of getCurrencyMethods(code)) {
        const inserted = await dbQuery<{ id: string }>(
          `INSERT INTO p2p_payment_methods (user_id, method_type, method_name, details, account_holder_name, is_verified)
           VALUES ($1, $2, $3, $4::jsonb, $5, TRUE)
           RETURNING id::TEXT AS id`,
          [vendorId, m.category, m.name, JSON.stringify({ accountIdentifier: seedAccountIdentifier(m.category, code) }), vendorName]
        );
        pmRows.push({ id: inserted[0].id, method_type: m.category, method_name: m.name, details: "" });
      }
    } else {
      for (const row of pmRows) {
        if (!row.details || row.details === "{}") {
          await dbQuery(
            `UPDATE p2p_payment_methods SET details = $2::jsonb, account_holder_name = $3, updated_at = NOW() WHERE id = $1`,
            [row.id, JSON.stringify({ accountIdentifier: seedAccountIdentifier(row.method_type, code) }), vendorName]
          );
        }
      }
    }

    const pmIds = pmRows.map((r) => r.id);

    const existingAds = await dbQuery<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count FROM p2p_ads WHERE user_id = $1`,
      [vendorId]
    );

    if (Number(existingAds[0]?.count ?? "0") === 0) {
      const sellPrice = Number((rate * 1.01).toFixed(2));
      const buyPrice = Number((rate * 0.99).toFixed(2));
      const minAmount = Math.round(rate * 50);
      const maxAmount = Math.round(rate * 100000);

      for (const crypto of CRYPTO_CURRENCIES) {
        await dbQuery(
          `INSERT INTO p2p_ads (user_id, ad_type, crypto_currency, chain, fiat_currency, price_type, price_value, min_amount, max_amount, payment_method_ids, status)
           VALUES ($1, 'sell', $2, 'avalanche', $3, 'fixed', $4, $5, $6, $7::bigint[], 'active')`,
          [vendorId, crypto, code, sellPrice, minAmount, maxAmount, pmIds]
        );
        await dbQuery(
          `INSERT INTO p2p_ads (user_id, ad_type, crypto_currency, chain, fiat_currency, price_type, price_value, min_amount, max_amount, payment_method_ids, status)
           VALUES ($1, 'buy', $2, 'avalanche', $3, 'fixed', $4, $5, $6, $7::bigint[], 'active')`,
          [vendorId, crypto, code, buyPrice, minAmount, maxAmount, pmIds]
        );
      }
    }
  }
}

export function ensureP2PSeeded(): Promise<void> {
  if (!global.__p2pSeeded) {
    global.__p2pSeeded = (async () => {
      await ensureDatabase();
      await seedP2PData();
    })();
  }
  return global.__p2pSeeded;
}

/**
 * Link any DAO vendor accounts that have NULL owner_user_id to the admin.
 * Runs lazily after the admin has signed in at least once (creating their user row).
 * Called from dashboard API / vendor status checks.
 */
export async function linkUnlinkedDAOVendors(): Promise<void> {
  await ensureDatabase();
  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) return;

  const adminRows = await dbQuery<{ id: string }>(
    `SELECT id::TEXT AS id FROM users WHERE email = $1 LIMIT 1`,
    [adminEmails[0]]
  );
  const adminUserId = adminRows[0]?.id;
  if (!adminUserId) return;

  await dbQuery(
    `UPDATE users SET owner_user_id = $2, updated_at = NOW()
     WHERE id LIKE 'kwizerana-dao-%' AND owner_user_id IS NULL`,
    [adminUserId]
  );
}
