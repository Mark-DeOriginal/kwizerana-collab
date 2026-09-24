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
    listMyDisputes(userId),
    getUnreadNotificationCount(userId)
  ]);

  const names = ["stats", "security", "wallets", "payment methods", "notifications", "vendor", "trades", "reviews", "disputes", "unread count"];
  results.forEach((result, index) => reportDashboardSection(names[index], result));

  const failedSections = results
    .map((result, index) => result.status === "rejected" ? names[index] : null)
    .filter((name): name is string => Boolean(name));
  if (failedSections.length > 0) {
    return NextResponse.json(
      { error: "Some dashboard information could not be loaded. Retrying is safe.", failedSections },
      { status: 503, headers: { "Retry-After": "2" } }
    );
  }

  const value = <T,>(index: number): T => (results[index] as PromiseFulfilledResult<T>).value;
  const stats = value<Awaited<ReturnType<typeof getP2PStats>>>(0);
  const security = value<Awaited<ReturnType<typeof getSecuritySummary>>>(1);
  const wallets = value<Awaited<ReturnType<typeof listWallets>>>(2);
  const paymentMethods = value<Awaited<ReturnType<typeof listUserPaymentMethods>>>(3);
  const notifications = value<Awaited<ReturnType<typeof listNotifications>>>(4);
  const vendor = value<Awaited<ReturnType<typeof getVendorStatus>>>(5);
  const trades = value<Awaited<ReturnType<typeof listTrades>>>(6);
  const submittedReviews = value<Awaited<ReturnType<typeof listSubmittedReviews>>>(7);
  const disputes = value<Awaited<ReturnType<typeof listMyDisputes>>>(8);
  const unreadCount = value<number>(9);

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
