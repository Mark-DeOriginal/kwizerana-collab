import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { getP2PStats, getSecuritySummary } from "@/lib/p2p/stats";
import { listWallets } from "@/lib/p2p/wallets";
import { listUserPaymentMethods } from "@/lib/p2p/payment-methods";
import { listNotifications } from "@/lib/p2p/notifications";
import { getVendorStatus } from "@/lib/p2p/vendor";
import { listTrades } from "@/lib/p2p/trades";
import { dbQuery, ensureDatabase } from "@/lib/db";
import { isAdminEmail } from "@/lib/roles";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { linkUnlinkedDAOVendors } from "@/lib/p2p/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Ensure DAO vendor accounts are linked to admin (handles late admin signup)
  await linkUnlinkedDAOVendors();

  const session = await getServerSession(authOptions);
  const isSuperAdmin = isAdminEmail(session?.user?.email);

  await ensureDatabase();
  const appRows = await dbQuery<{ status: string }>(
    `SELECT status FROM p2p_advertiser_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  const vendorApplication = appRows.length > 0 ? { status: appRows[0].status } : null;

  const [stats, security, wallets, paymentMethods, notifications, vendor, trades] = await Promise.all([
    getP2PStats(userId),
    getSecuritySummary(userId),
    listWallets(userId),
    listUserPaymentMethods(userId),
    listNotifications(userId, 8),
    getVendorStatus(userId),
    listTrades(userId)
  ]);

  return NextResponse.json({
    stats,
    security,
    wallets,
    paymentMethods,
    notifications,
    vendor,
    trades,
    vendorApplication,
    isSuperAdmin
  });
}
