import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { applyTradeAction, getTrade, type TradeAction } from "@/lib/p2p/trades";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const trade = await getTrade(userId, params.id);
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
  const receipt = body.receipt ? String(body.receipt) : undefined;
  const receiptImage = body.receipt_image ? String(body.receipt_image) : undefined;

  const validActions: TradeAction[] = ["lock", "mark_paid", "release", "cancel"];
  if (!validActions.includes(action as TradeAction)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  try {
    const trade = await applyTradeAction(userId, params.id, action as TradeAction, receipt, receiptImage);
    return NextResponse.json({ trade });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to update trade." }, { status: 400 });
  }
}
