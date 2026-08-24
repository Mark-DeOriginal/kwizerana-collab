import { dbQuery, ensureDatabase } from "@/lib/db";
import { CRYPTO_CURRENCIES, FIAT_CURRENCIES, SEED_RATES } from "@/lib/p2p/currencies-shared";
import { SUPPORTED_METHODS } from "@/lib/p2p/payment-methods-shared";

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
