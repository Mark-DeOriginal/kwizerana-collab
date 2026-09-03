import { dbQuery, ensureDatabase } from "@/lib/db";
import { CRYPTO_CURRENCIES, FIAT_CURRENCIES, SEED_RATES } from "@/lib/p2p/currencies-shared";

// CoinGecko simple/price is keyless (demo key optional), supports crypto→fiat
// across all the fiats we trade, and is widely used in production.
const COINGECKO_IDS: Record<string, string> = {
  USDT: "tether",
  USDC: "usd-coin"
};

const FIAT_CODES = FIAT_CURRENCIES.map((f) => f.code.toLowerCase()).join(",");

/**
 * Pulls live USDT/USDC prices (in every traded fiat) from CoinGecko and upserts
 * them into `p2p_currency_rates`. Non-destructive: keeps last-known-good values
 * on any individual failure.
 *
 * IMPORTANT: This is only called from the admin-triggered refresh endpoint,
 * NEVER from the trade/offers hot path. This avoids blocking page loads with
 * third-party API calls.
 */
export async function refreshRates(): Promise<void> {
  await ensureDatabase();

  const ids = CRYPTO_CURRENCIES.map((c) => COINGECKO_IDS[c]).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${FIAT_CODES}`;
  const headers: Record<string, string> = { accept: "application/json" };
  if (process.env.COINGECKO_API_KEY) headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`CoinGecko returned ${res.status}`);
  const data = (await res.json()) as Record<string, Record<string, number>>;

  let updated = 0;
  for (const crypto of CRYPTO_CURRENCIES) {
    const prices = data[COINGECKO_IDS[crypto]];
    if (!prices) continue;
    for (const fiat of FIAT_CURRENCIES) {
      const rate = Number(prices[fiat.code.toLowerCase()]);
      if (!Number.isFinite(rate) || rate <= 0) continue;
      await dbQuery(
        `INSERT INTO p2p_currency_rates (crypto_currency, fiat_currency, rate, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (crypto_currency, fiat_currency)
         DO UPDATE SET rate = $3, updated_at = NOW()`,
        [crypto, fiat.code, rate]
      );
      updated++;
    }
  }
  if (updated === 0) throw new Error("CoinGecko returned no usable rates.");
}

/** Returns all live rates from DB — no network calls, no blocking. */
export async function listLiveRates(): Promise<Record<string, number>> {
  await ensureDatabase();
  const rows = await dbQuery<{ crypto_currency: string; fiat_currency: string; rate: string }>(
    `SELECT crypto_currency, fiat_currency, rate::TEXT AS rate FROM p2p_currency_rates`
  );
  const map: Record<string, number> = {};
  for (const r of rows) {
    const n = Number(r.rate);
    if (Number.isFinite(n) && n > 0) map[`${r.crypto_currency}:${r.fiat_currency}`] = n;
  }
  return map;
}

/** Returns a single rate from DB — no network calls, no blocking. */
export async function getLiveRate(cryptoCurrency: string, fiatCurrency: string): Promise<number> {
  await ensureDatabase();
  const rows = await dbQuery<{ rate: string }>(
    `SELECT rate::TEXT AS rate FROM p2p_currency_rates WHERE crypto_currency = $1 AND fiat_currency = $2`,
    [cryptoCurrency, fiatCurrency]
  );
  const n = rows[0] ? Number(rows[0].rate) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  return SEED_RATES[fiatCurrency] ?? 1;
}

/** Returns all rates as rows for the admin UI. */
export async function listAllRates(): Promise<{ crypto_currency: string; fiat_currency: string; rate: number; updated_at: string }[]> {
  await ensureDatabase();
  const rows = await dbQuery<{ crypto_currency: string; fiat_currency: string; rate: string; updated_at: string }>(
    `SELECT crypto_currency, fiat_currency, rate::TEXT AS rate, updated_at::TEXT AS updated_at
     FROM p2p_currency_rates
     ORDER BY crypto_currency, fiat_currency`
  );
  return rows.map((r) => ({
    crypto_currency: r.crypto_currency,
    fiat_currency: r.fiat_currency,
    rate: Number(r.rate),
    updated_at: r.updated_at
  }));
}
