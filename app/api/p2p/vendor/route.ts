import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { becomeVendor, closeVendorAccount, getVendorStatus } from "@/lib/p2p/vendor";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/roles";

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

export async function DELETE() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const session = await getServerSession(authOptions);
  if (isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Default administrator vendors cannot be closed here." }, { status: 403 });
  }

  const result = await closeVendorAccount(userId);
  if (result.ok) return NextResponse.json({ ok: true });

  const messages = {
    not_vendor: "This account is not currently a vendor.",
    managed_account: "Managed and default vendor accounts cannot be closed here.",
    active_trades: `Complete or close your active trades before stopping vendor activity${result.count ? ` (${result.count} remaining)` : ""}.`,
    open_disputes: `Resolve your open disputes before stopping vendor activity${result.count ? ` (${result.count} remaining)` : ""}.`
  } as const;
  return NextResponse.json({ error: messages[result.reason], reason: result.reason }, { status: 409 });
}
