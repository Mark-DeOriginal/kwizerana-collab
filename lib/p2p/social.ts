import { dbQuery, ensureDatabase } from "@/lib/db";

export type SocialState = {
  favorites: string[];
  blocked: string[];
  pinned: string[];
};

export async function getSocialState(userId: string): Promise<SocialState> {
  await ensureDatabase();
  const [favRows, blockRows, pinRows] = await Promise.all([
    dbQuery<{ vendor_id: string }>(`SELECT vendor_id FROM p2p_favorites WHERE user_id = $1`, [userId]),
    dbQuery<{ blocked_id: string }>(`SELECT blocked_id FROM p2p_blocklist WHERE user_id = $1`, [userId]),
    dbQuery<{ vendor_id: string }>(`SELECT vendor_id FROM p2p_pins WHERE user_id = $1`, [userId])
  ]);
  return {
    favorites: favRows.map((r) => r.vendor_id),
    blocked: blockRows.map((r) => r.blocked_id),
    pinned: pinRows.map((r) => r.vendor_id)
  };
}

export async function togglePin(userId: string, vendorId: string): Promise<boolean> {
  await ensureDatabase();
  if (vendorId === userId) throw new Error("You cannot pin yourself.");
  const rows = await dbQuery<{ vendor_id: string }>(
    `DELETE FROM p2p_pins WHERE user_id = $1 AND vendor_id = $2 RETURNING vendor_id`,
    [userId, vendorId]
  );
  if (rows.length === 0) {
    await dbQuery(
      `INSERT INTO p2p_pins (user_id, vendor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, vendorId]
    );
    return true;
  }
  return false;
}

export async function toggleFavorite(userId: string, vendorId: string): Promise<boolean> {
  await ensureDatabase();
  if (vendorId === userId) throw new Error("You cannot favorite yourself.");
  const rows = await dbQuery<{ vendor_id: string }>(
    `DELETE FROM p2p_favorites WHERE user_id = $1 AND vendor_id = $2 RETURNING vendor_id`,
    [userId, vendorId]
  );
  if (rows.length === 0) {
    await dbQuery(
      `INSERT INTO p2p_favorites (user_id, vendor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, vendorId]
    );
    return true;
  }
  return false;
}

export async function toggleBlock(userId: string, blockedId: string): Promise<boolean> {
  await ensureDatabase();
  if (blockedId === userId) throw new Error("You cannot block yourself.");
  const rows = await dbQuery<{ blocked_id: string }>(
    `DELETE FROM p2p_blocklist WHERE user_id = $1 AND blocked_id = $2 RETURNING blocked_id`,
    [userId, blockedId]
  );
  if (rows.length === 0) {
    await dbQuery(
      `INSERT INTO p2p_blocklist (user_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, blockedId]
    );
    return true;
  }
  return false;
}
