import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { applyTradeAction, getTrade, type TradeAction } from "@/lib/p2p/trades";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/roles";

export const dynamic = "force-dynamic";

async function getSuperAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return isAdminEmail(session?.user?.email);
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const trade = await getTrade(userId, params.id, undefined, await getSuperAdmin());
    return NextResponse.json({ trade });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Trade not found." }, { status: 404 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const action = String(body.action ?? "");
  const validActions: TradeAction[] = ["accept", "mark_paid", "release", "claim", "cancel", "refund", "decline", "proceed"];
  if (!validActions.includes(action as TradeAction)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const input = {
    receipt: body.receipt ? String(body.receipt) : undefined,
    receiptImage: body.receipt_image ? String(body.receipt_image) : undefined,
    walletAddress: body.wallet_address ? String(body.wallet_address) : undefined,
    txHash: body.tx_hash ? String(body.tx_hash) : undefined,
    destAddress: body.dest_address ? String(body.dest_address) : undefined,
    declineFeedback: body.decline_feedback ? String(body.decline_feedback) : undefined
  };

  try {
    const trade = await applyTradeAction(userId, params.id, action as TradeAction, input, await getSuperAdmin());
    return NextResponse.json({ trade });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to update trade." }, { status: 400 });
  }
}