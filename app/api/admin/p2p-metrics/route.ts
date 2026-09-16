import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { dbQuery, ensureDatabase } from "@/lib/db";
import { hasPermission, isAdminEmail } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const allowDevAdmin = process.env.NODE_ENV !== "production" && !process.env.GOOGLE_CLIENT_ID;
  const allowed = allowDevAdmin || isAdminEmail(session?.user?.email) ||
    hasPermission(session?.user?.role ?? "member", session?.user?.permissions ?? [], "view_dashboard");
  if (!allowed) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  await ensureDatabase();
  const [summaryRows, cryptoVolumes, fiatVolumes] = await Promise.all([
    dbQuery<{ total_trades: string; completed_trades: string; verified_trades: string; active_trades: string; open_disputes: string }>(
      `SELECT COUNT(*)::TEXT AS total_trades,
              COUNT(*) FILTER (WHERE t.status = 'completed')::TEXT AS completed_trades,
              COUNT(*) FILTER (WHERE t.status = 'completed' AND e.status = 'claimed' AND e.chain_verified_at IS NOT NULL)::TEXT AS verified_trades,
              COUNT(*) FILTER (WHERE t.status IN ('created', 'escrow_locked', 'payment_sent', 'released'))::TEXT AS active_trades,
              COUNT(*) FILTER (WHERE t.status = 'disputed')::TEXT AS open_disputes
       FROM p2p_trades t
       LEFT JOIN LATERAL (SELECT status, chain_verified_at FROM p2p_escrow WHERE trade_id = t.id ORDER BY id DESC LIMIT 1) e ON TRUE`
    ),
    dbQuery<{ currency: string; amount: string }>(
      `SELECT t.crypto_currency AS currency, COALESCE(SUM(t.crypto_amount), 0)::TEXT AS amount
       FROM p2p_trades t
       JOIN LATERAL (SELECT status, chain_verified_at FROM p2p_escrow WHERE trade_id = t.id ORDER BY id DESC LIMIT 1) e ON TRUE
       WHERE t.status = 'completed' AND e.status = 'claimed' AND e.chain_verified_at IS NOT NULL
       GROUP BY t.crypto_currency ORDER BY t.crypto_currency`
    ),
    dbQuery<{ currency: string; amount: string }>(
      `SELECT t.fiat_currency AS currency, COALESCE(SUM(t.fiat_amount), 0)::TEXT AS amount
       FROM p2p_trades t
       JOIN LATERAL (SELECT status, chain_verified_at FROM p2p_escrow WHERE trade_id = t.id ORDER BY id DESC LIMIT 1) e ON TRUE
       WHERE t.status = 'completed' AND e.status = 'claimed' AND e.chain_verified_at IS NOT NULL
       GROUP BY t.fiat_currency ORDER BY t.fiat_currency`
    )
  ]);

  const summary = summaryRows[0];
  return NextResponse.json({
    summary: {
      totalTrades: Number(summary?.total_trades ?? 0),
      completedTrades: Number(summary?.completed_trades ?? 0),
      verifiedTrades: Number(summary?.verified_trades ?? 0),
      activeTrades: Number(summary?.active_trades ?? 0),
      openDisputes: Number(summary?.open_disputes ?? 0)
    },
    cryptoVolumes: cryptoVolumes.map((row) => ({ currency: row.currency, amount: Number(row.amount) })),
    fiatVolumes: fiatVolumes.map((row) => ({ currency: row.currency, amount: Number(row.amount) }))
  });
}
