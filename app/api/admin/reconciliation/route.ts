import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { hasPermission, isAdminEmail } from "@/lib/roles";
import { dbQuery, ensureDatabase } from "@/lib/db";
import { reconcileEscrowProjections } from "@/lib/p2p/reconciliation";

export const dynamic = "force-dynamic";

async function canReview() {
  const session = await getServerSession(authOptions);
  const dev = process.env.NODE_ENV !== "production" && !process.env.GOOGLE_CLIENT_ID;
  return dev || isAdminEmail(session?.user?.email) || hasPermission(session?.user?.role ?? "member", session?.user?.permissions ?? [], "manage_disputes");
}

export async function GET() {
  if (!(await canReview())) return NextResponse.json({ error: "Reconciliation access required." }, { status: 403 });
  await ensureDatabase();
  const rows = await dbQuery(
    `SELECT t.id::TEXT AS trade_id, t.trade_ref, t.status AS trade_status,
            t.crypto_currency, t.crypto_amount::TEXT AS crypto_amount,
            t.updated_at, e.status AS escrow_status,
            e.debit_tx_hash, e.release_tx_hash, e.claim_tx_hash, e.refund_tx_hash,
            e.chain_verified_at
     FROM p2p_trades t
     JOIN LATERAL (SELECT * FROM p2p_escrow WHERE trade_id = t.id ORDER BY id DESC LIMIT 1) e ON TRUE
     WHERE t.status = 'reconciliation_required' OR (e.status IN ('funded', 'released', 'claimed', 'refunded') AND e.chain_verified_at IS NULL)
     ORDER BY t.updated_at ASC
     LIMIT 200`
  );
  return NextResponse.json({ items: rows });
}

export async function POST() {
  if (!(await canReview())) return NextResponse.json({ error: "Reconciliation access required." }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, ...(await reconcileEscrowProjections(200)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Reconciliation failed." }, { status: 500 });
  }
}
