import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { getP2PStats, getSecuritySummary } from "@/lib/p2p/stats";
import { listWallets } from "@/lib/p2p/wallets";
import { listUserPaymentMethods } from "@/lib/p2p/payment-methods";
import { listNotifications } from "@/lib/p2p/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const [stats, security, wallets, paymentMethods, notifications] = await Promise.all([
    getP2PStats(userId),
    getSecuritySummary(userId),
    listWallets(userId),
    listUserPaymentMethods(userId),
    listNotifications(userId, 8)
  ]);

  return NextResponse.json({
    stats,
    security,
    wallets,
    paymentMethods,
    notifications
  });
}
