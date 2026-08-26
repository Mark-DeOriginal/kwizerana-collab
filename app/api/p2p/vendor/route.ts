import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { becomeVendor, getVendorStatus } from "@/lib/p2p/vendor";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const status = await getVendorStatus(userId);
  return NextResponse.json(status);
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

  const cryptoAvailable = Number(body.cryptoAvailable);
  const fiatAvailable = Number(body.fiatAvailable);
  const rate = Number(body.rate);
  const paymentMethodIds = Array.isArray(body.paymentMethodIds)
    ? body.paymentMethodIds.map((id) => String(id))
    : [];

  if (!Number.isFinite(cryptoAvailable) || cryptoAvailable < 0) {
    return NextResponse.json({ error: "Enter a valid USDT amount." }, { status: 400 });
  }
  if (!Number.isFinite(fiatAvailable) || fiatAvailable < 0) {
    return NextResponse.json({ error: "Enter a valid fiat amount." }, { status: 400 });
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    return NextResponse.json({ error: "Enter a valid rate." }, { status: 400 });
  }

  await becomeVendor(userId, { cryptoAvailable, fiatAvailable, rate, paymentMethodIds });

  return NextResponse.json({ ok: true });
}
