import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { getP2PStats, getSecuritySummary } from "@/lib/p2p/stats";
import { listWallets } from "@/lib/p2p/wallets";
import { listUserPaymentMethods } from "@/lib/p2p/payment-methods";
import { listNotifications, getUnreadNotificationCount } from "@/lib/p2p/notifications";
import { getVendorStatus } from "@/lib/p2p/vendor";
import { listTrades } from "@/lib/p2p/trades";
import { listSubmittedReviews } from "@/lib/p2p/reviews";
import { listMyDisputes } from "@/lib/p2p/disputes";
import { dbQuery, ensureDatabase } from "@/lib/db";
import { isAdminEmail } from "@/lib/roles";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { linkUnlinkedDAOVendors } from "@/lib/p2p/seed";

export const dynamic = "force-dynamic";

function reportDashboardSection(name: string, result: PromiseSettledResult<unknown>) {
  if (result.status === "rejected") {
    console.error(`Dashboard section failed: ${name}`, result.reason instanceof Error ? result.reason.message : result.reason);
  }
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // This housekeeping must never prevent a member from opening the dashboard.
  try {
    await linkUnlinkedDAOVendors();
  } catch (error) {
    console.error("Dashboard vendor linking failed", error instanceof Error ? error.message : error);
  }

  const session = await getServerSession(authOptions);
  const isSuperAdmin = isAdminEmail(session?.user?.email);

  await ensureDatabase();
  const appRows = await dbQuery<{ status: string }>(
    `SELECT status FROM p2p_advertiser_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  const vendorApplication = appRows.length > 0 ? { status: appRows[0].status } : null;

  const results = await Promise.allSettled([
    getP2PStats(userId),
    getSecuritySummary(userId),
    listWallets(userId),
    listUserPaymentMethods(userId),
    listNotifications(userId, 8),
    getVendorStatus(userId),
    listTrades(userId, isSuperAdmin),
    listSubmittedReviews(userId),
    listMyDisputes(userId)
  ]);

  const names = ["stats", "security", "wallets", "payment methods", "notifications", "vendor", "trades", "reviews", "disputes"];
  results.forEach((result, index) => reportDashboardSection(names[index], result));

  const value = <T,>(index: number, fallback: T): T =>
    results[index].status === "fulfilled" ? results[index].value as T : fallback;

  const stats = value(0, {
    totalTrades: 0, completedTrades: 0, completionRate30d: 0, volume30d: 0,
    avgReleaseSeconds: 0, cumulativeCounterparties: 0, trustScore: 0,
    advertiserStatus: "none", advertiserLevel: "none", verifiedTier: "none",
    firstTradeAt: null, isOnline: false
  });
  const security = value(1, { twoFactorEnabled: false, antiPhishingSet: false, hasPassword: false, emailVerified: false });
  const wallets = value(2, []);
  const paymentMethods = value(3, []);
  const notifications = value(4, []);
  const vendor = value(5, { isVendor: false, advertiserStatus: "none", advertiserLevel: "none", verifiedTier: "none", availableCrypto: 0, availableFiat: 0 });
  const trades = value(6, []);
  const submittedReviews = value(7, []);
  const disputes = value(8, []);

  let unreadCount = 0;
  try {
    unreadCount = await getUnreadNotificationCount(userId);
  } catch (error) {
    console.error("Dashboard section failed: unread count", error instanceof Error ? error.message : error);
  }

  return NextResponse.json({
    stats,
    security,
    wallets,
    paymentMethods,
    notifications,
    vendor,
    trades,
    submittedReviews,
    disputes,
    unreadCount,
    vendorApplication,
    isSuperAdmin
  });
}
