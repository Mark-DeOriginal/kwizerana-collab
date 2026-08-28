import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { getOwnedVendorIds } from "@/lib/p2p/trades";
import { dbQuery, ensureDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Cheap realtime fingerprint for the dashboard. Clients poll this repeatedly;
 * only when `changedAt` moves do they pay for a full dashboard reload.
 * Scope mirrors listTrades: everything the user (or their owned vendors) can see.
 */
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  await ensureDatabase();
  const ownedVendorIds = await getOwnedVendorIds(userId);
  const allIds = [userId, ...Array.from(ownedVendorIds)];

  // Mirror the dashboard's expiry sweep so overdue orders move the fingerprint.
  await dbQuery(
    `UPDATE p2p_trades SET status = 'expired', updated_at = NOW()
     WHERE status IN ('created', 'escrow_locked') AND expires_at < NOW()
       AND (buyer_id = ANY($1) OR seller_id = ANY($1))`,
    [allIds]
  );

  const rows = await dbQuery<{ changed_at: string }>(
    `SELECT GREATEST(
       COALESCE((SELECT MAX(COALESCE(updated_at, created_at)) FROM p2p_trades WHERE buyer_id = ANY($1) OR seller_id = ANY($1)), '-infinity'::timestamptz),
       COALESCE((SELECT MAX(COALESCE(updated_at, created_at)) FROM p2p_notifications WHERE user_id = $2), '-infinity'::timestamptz),
       COALESCE((SELECT MAX(COALESCE(reviewed_at, created_at)) FROM p2p_advertiser_applications WHERE user_id = $2), '-infinity'::timestamptz),
       COALESCE((SELECT MAX(updated_at) FROM users WHERE id = $2), '-infinity'::timestamptz)
     )::TEXT AS changed_at`,
    [allIds, userId]
  );

  return NextResponse.json({ changedAt: rows[0]?.changed_at ?? "" });
}