import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { applyTradeAction, getTrade, type TradeAction } from "@/lib/p2p/trades";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/roles";

export const dynamic = "force-dynamic";

const PUBLIC_TRADE_ACTION_ERRORS = [
  /^Trade not found\.$/,
  /^The wallet transaction hash is invalid\.$/,
  /^The connected wallet address is invalid\.$/,
  /^The receive wallet address is invalid\.$/,
  /^A confirmed escrow transaction is required\.$/,
  /^The buyer must set a receive wallet/,
  /^Only the /,
  /^This order /,
  /^Connect your wallet /,
  /^Payment can only /,
  /^There is no /,
  /^This payment method /,
  /^The crypto is not /,
  /^Choose where /,
  /^The escrow /,
  /^Please provide /,
  /^The action request identifier /,
  /^This trade changed /,
  /^Inventory can only /,
  /^The transaction was sent /,
  /^This crypto asset /,
  /^The escrow receipt /,
  /^The escrow transaction /,
  /^The escrow transaction was submitted /
];

function publicTradeActionError(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  return PUBLIC_TRADE_ACTION_ERRORS.some((pattern) => pattern.test(error.message)) ? error.message : null;
}

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
    actionRequestId: body.action_request_id ? String(body.action_request_id) : undefined,
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
    const publicMessage = publicTradeActionError(err);
    if (!publicMessage) {
      console.error("Trade action failed", {
        tradeId: params.id,
        action,
        error: err instanceof Error ? err.message : "Unknown error"
      });
    }
    return NextResponse.json(
      { error: publicMessage ?? "Unable to update this trade right now. Please try again." },
      { status: publicMessage ? 400 : 500 }
    );
  }
}
