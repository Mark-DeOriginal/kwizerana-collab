import { dbQuery, ensureDatabase } from "@/lib/db";
import { getOwnedVendorIds } from "@/lib/p2p/trades";
import { SEED_RATES } from "@/lib/p2p/currencies-shared";

export type P2PAd = {
  id: string;
  user_id: string;
  ad_type: "buy" | "sell";
  crypto_currency: string;
  chain: string;
  fiat_currency: string;
  price_type: string;
  price_value: number;
  price_margin: number | null;
  min_amount: number;
  max_amount: number;
  payment_method_ids: string[];
  instructions: string;
  status: string;
  is_paused: boolean;
  trade_count: number;
  created_at: string;
  updated_at: string;
};

type AdRow = Omit<P2PAd, "price_value" | "price_margin" | "min_amount" | "max_amount" | "payment_method_ids"> & {
  price_value: string;
  price_margin: string | null;
  min_amount: string;
  max_amount: string;
  payment_method_ids: string[] | null;
};

function mapAd(row: AdRow): P2PAd {
  return {
    ...row,
    price_value: Number(row.price_value),
    price_margin: row.price_margin == null ? null : Number(row.price_margin),
    min_amount: Number(row.min_amount),
    max_amount: Number(row.max_amount),
    payment_method_ids: row.payment_method_ids ?? []
  };
}

const AD_SELECT = `SELECT a.id::TEXT AS id, a.user_id, a.ad_type, a.crypto_currency, a.chain, a.fiat_currency,
       a.price_type, a.price_value::TEXT AS price_value, a.price_margin::TEXT AS price_margin,
       a.min_amount::TEXT AS min_amount, a.max_amount::TEXT AS max_amount,
       a.payment_method_ids, a.instructions, a.status, a.is_paused, a.trade_count,
       a.created_at, a.updated_at
FROM p2p_ads a`;

async function ownedAdIds(userId: string): Promise<string[]> {
  const ownedVendorIds = await getOwnedVendorIds(userId);
  return [userId, ...Array.from(ownedVendorIds)];
}

export async function listMyAds(userId: string): Promise<P2PAd[]> {
  await ensureDatabase();
  const ids = await ownedAdIds(userId);
  const rows = await dbQuery<AdRow>(
    `${AD_SELECT} WHERE a.user_id = ANY($1) ORDER BY a.created_at DESC`,
    [ids]
  );
  return rows.map(mapAd);
}

export async function createAd(
  userId: string,
  input: {
    ad_type: "buy" | "sell";
    crypto_currency: string;
    fiat_currency: string;
    price_type: string;
    price_value: number;
    price_margin: number | null;
    min_amount: number;
    max_amount: number;
    payment_method_ids: string[];
  }
): Promise<P2PAd> {
  await ensureDatabase();

  const inserted = await dbQuery<{ id: string }>(
    `INSERT INTO p2p_ads (user_id, ad_type, crypto_currency, chain, fiat_currency, price_type, price_value, price_margin, min_amount, max_amount, payment_method_ids, status)
     VALUES ($1, $2, $3, 'avalanche', $4, $5, $6, $7, $8, $9, $10::bigint[], 'active')
     RETURNING id::TEXT AS id`,
    [
      userId,
      input.ad_type,
      input.crypto_currency,
      input.fiat_currency,
      input.price_type,
      input.price_value,
      input.price_margin,
      input.min_amount,
      input.max_amount,
      input.payment_method_ids
    ]
  );

  const rows = await dbQuery<AdRow>(`${AD_SELECT} WHERE a.id = $1`, [inserted[0].id]);
  return mapAd(rows[0]);
}

export async function updateAd(
  userId: string,
  adId: string,
  input: Partial<{
    price_value: number;
    price_margin: number | null;
    min_amount: number;
    max_amount: number;
    is_paused: boolean;
    status: string;
  }>
): Promise<P2PAd> {
  await ensureDatabase();
  const ids = await ownedAdIds(userId);
  const rows = await dbQuery<{ id: string }>(
    `SELECT id::TEXT AS id FROM p2p_ads WHERE id = $1 AND user_id = ANY($2)`,
    [adId, ids]
  );
  if (!rows[0]) throw new Error("Ad not found.");

  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (input.price_value !== undefined) { fields.push(`price_value = $${i++}`); params.push(input.price_value); }
  if (input.price_margin !== undefined) { fields.push(`price_margin = $${i++}`); params.push(input.price_margin); }
  if (input.min_amount !== undefined) { fields.push(`min_amount = $${i++}`); params.push(input.min_amount); }
  if (input.max_amount !== undefined) { fields.push(`max_amount = $${i++}`); params.push(input.max_amount); }
  if (input.is_paused !== undefined) { fields.push(`is_paused = $${i++}`); params.push(input.is_paused); }
  if (input.status !== undefined) { fields.push(`status = $${i++}`); params.push(input.status); }

  if (fields.length === 0) {
    const existing = await dbQuery<AdRow>(`${AD_SELECT} WHERE a.id = $1`, [adId]);
    return mapAd(existing[0]);
  }

  fields.push("updated_at = NOW()");
  params.push(adId);
  await dbQuery(
    `UPDATE p2p_ads SET ${fields.join(", ")} WHERE id = $${i}`,
    params
  );

  const updated = await dbQuery<AdRow>(`${AD_SELECT} WHERE a.id = $1`, [adId]);
  return mapAd(updated[0]);
}

export async function deleteAd(userId: string, adId: string): Promise<boolean> {
  await ensureDatabase();
  const ids = await ownedAdIds(userId);
  const rows = await dbQuery<{ id: string }>(
    `DELETE FROM p2p_ads WHERE id = $1 AND user_id = ANY($2) RETURNING id::TEXT AS id`,
    [adId, ids]
  );
  return rows.length > 0;
}

/** A sensible default rate for a new ad when the user hasn't provided one. */
export function defaultRate(fiatCurrency: string): number {
  return SEED_RATES[fiatCurrency] ?? 1;
}
