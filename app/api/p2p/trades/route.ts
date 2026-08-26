import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { createTrade, listTrades } from "@/lib/p2p/trades";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const trades = await listTrades(userId);
  return NextResponse.json({ trades });
}

export async function POST(request: Request) {
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

  const adId = String(body.adId ?? "");
  const cryptoAmount = Number(body.cryptoAmount);
  const paymentMethodId = body.paymentMethodId ? String(body.paymentMethodId) : null;

  if (!adId) {
    return NextResponse.json({ error: "Missing vendor." }, { status: 400 });
  }
  if (!Number.isFinite(cryptoAmount) || cryptoAmount <= 0) {
    return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });
  }

  try {
    const trade = await createTrade(userId, { adId, cryptoAmount, paymentMethodId });
    return NextResponse.json({ trade }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to create trade." }, { status: 400 });
  }
}
