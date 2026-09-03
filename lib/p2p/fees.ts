import { dbQuery, ensureDatabase } from "@/lib/db";

export type FeeSchedule = {
  makerFee: number;
  takerFee: number;
};

export async function getFees(cryptoCurrency: string, fiatCurrency: string): Promise<FeeSchedule> {
  await ensureDatabase();
  const rows = await dbQuery<{ maker_fee: string; taker_fee: string }>(
    `SELECT maker_fee::TEXT AS maker_fee, taker_fee::TEXT AS taker_fee
     FROM p2p_fees WHERE crypto_currency = $1 AND fiat_currency = $2`,
    [cryptoCurrency, fiatCurrency]
  );
  const r = rows[0];
  return {
    makerFee: r ? Number(r.maker_fee) : 0,
    takerFee: r ? Number(r.taker_fee) : 0
  };
}

/** Loads all configured fees keyed by `${crypto}:${fiat}`. */
export async function listAllFees(): Promise<Record<string, FeeSchedule>> {
  await ensureDatabase();
  const rows = await dbQuery<{ crypto_currency: string; fiat_currency: string; maker_fee: string; taker_fee: string }>(
    `SELECT crypto_currency, fiat_currency, maker_fee::TEXT AS maker_fee, taker_fee::TEXT AS taker_fee FROM p2p_fees`
  );
  const map: Record<string, FeeSchedule> = {};
  for (const r of rows) {
    map[`${r.crypto_currency}:${r.fiat_currency}`] = { makerFee: Number(r.maker_fee), takerFee: Number(r.taker_fee) };
  }
  return map;
}
