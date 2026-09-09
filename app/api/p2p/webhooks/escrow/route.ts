import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { reconcileEscrowTransaction } from "@/lib/p2p/reconciliation";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.ESCROW_WEBHOOK_SECRET;
  if (!secret) return false;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => null) as { transactionHash?: unknown; txHash?: unknown } | null;
  const txHash = String(body?.transactionHash ?? body?.txHash ?? "").trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return NextResponse.json({ error: "A valid transaction hash is required." }, { status: 400 });
  }

  try {
    const result = await reconcileEscrowTransaction(txHash);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook processing failed." }, { status: 500 });
  }
}
