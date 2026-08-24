import { dbQuery, ensureDatabase } from "@/lib/db";

export type { Chain } from "@/lib/p2p/wallets-shared";
export { SUPPORTED_CHAINS, chainLabel, validateWalletAddress } from "@/lib/p2p/wallets-shared";

export type UserWallet = {
  id: string;
  chain: string;
  wallet_address: string;
  is_primary: boolean;
  created_at: string;
};

export async function listWallets(userId: string): Promise<UserWallet[]> {
  await ensureDatabase();
  return dbQuery<UserWallet>(
    `SELECT id, chain, wallet_address, is_primary, created_at
     FROM p2p_user_wallets
     WHERE user_id = $1
     ORDER BY is_primary DESC, created_at ASC`,
    [userId]
  );
}

export async function addWallet(userId: string, chain: string, address: string): Promise<UserWallet | null> {
  await ensureDatabase();

  const countRows = await dbQuery<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count FROM p2p_user_wallets WHERE user_id = $1`,
    [userId]
  );
  const isPrimary = Number(countRows[0]?.count ?? "0") === 0;

  const inserted = await dbQuery<UserWallet>(
    `INSERT INTO p2p_user_wallets (user_id, chain, wallet_address, is_primary)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, chain, wallet_address) DO NOTHING
     RETURNING id, chain, wallet_address, is_primary, created_at`,
    [userId, chain, address, isPrimary]
  );

  if (inserted[0]) return inserted[0];

  const existing = await dbQuery<UserWallet>(
    `SELECT id, chain, wallet_address, is_primary, created_at
     FROM p2p_user_wallets
     WHERE user_id = $1 AND chain = $2 AND wallet_address = $3`,
    [userId, chain, address]
  );
  return existing[0] ?? null;
}

export async function setPrimaryWallet(userId: string, walletId: string): Promise<boolean> {
  await ensureDatabase();
  const rows = await dbQuery<{ id: string }>(
    `UPDATE p2p_user_wallets SET is_primary = (id = $1) WHERE user_id = $2 RETURNING id`,
    [walletId, userId]
  );
  return rows.length > 0;
}

export async function removeWallet(userId: string, walletId: string): Promise<boolean> {
  await ensureDatabase();
  const rows = await dbQuery<{ id: string }>(
    `DELETE FROM p2p_user_wallets WHERE id = $1 AND user_id = $2 RETURNING id`,
    [walletId, userId]
  );
  return rows.length > 0;
}
