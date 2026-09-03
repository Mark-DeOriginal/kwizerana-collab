import { dbQuery, ensureDatabase } from "@/lib/db";
import type { Currency, CurrencyRate } from "@/lib/p2p/currencies-shared";

export type { Currency, CurrencyRate, FiatSeed } from "@/lib/p2p/currencies-shared";
export { CRYPTO_CURRENCIES, FIAT_CURRENCIES, SEED_RATES } from "@/lib/p2p/currencies-shared";

export async function listCurrencies(): Promise<Currency[]> {
  await ensureDatabase();
  return dbQuery<Currency>(
    `SELECT id::TEXT AS id, code, name, region, is_fiat, is_active
     FROM p2p_currencies
     WHERE is_active = TRUE
     ORDER BY is_fiat DESC, region ASC, code ASC`
  );
}

export async function listRates(): Promise<CurrencyRate[]> {
  await ensureDatabase();
  return dbQuery<CurrencyRate>(
    `SELECT crypto_currency, fiat_currency, rate::TEXT AS rate, updated_at
     FROM p2p_currency_rates
     ORDER BY crypto_currency ASC, fiat_currency ASC`
  );
}

export async function getRate(cryptoCurrency: string, fiatCurrency: string): Promise<CurrencyRate | null> {
  await ensureDatabase();
  const rows = await dbQuery<CurrencyRate>(
    `SELECT crypto_currency, fiat_currency, rate::TEXT AS rate, updated_at
     FROM p2p_currency_rates
     WHERE crypto_currency = $1 AND fiat_currency = $2`,
    [cryptoCurrency, fiatCurrency]
  );
  return rows[0] ?? null;
}
