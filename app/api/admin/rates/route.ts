import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { hasPermission, isAdminEmail } from "@/lib/roles";
import { listAllRates } from "@/lib/p2p/price-feed";
import { dbQuery } from "@/lib/db";
import { CRYPTO_CURRENCIES, FIAT_CURRENCIES } from "@/lib/p2p/currencies-shared";

export const dynamic = "force-dynamic";

function requireAdmin() {
  return getServerSession(authOptions).then((session) => {
    const allowDevAdmin = process.env.NODE_ENV !== "production" && !process.env.GOOGLE_CLIENT_ID;
    const isAllowed = allowDevAdmin || isAdminEmail(session?.user?.email) ||
      hasPermission(session?.user?.role ?? "member", session?.user?.permissions ?? [], "view_dashboard");
    return isAllowed;
  });
}

export async function GET() {
  const isAllowed = await requireAdmin();
  if (!isAllowed) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const rates = await listAllRates();
  return NextResponse.json({ rates });
}

export async function POST(request: Request) {
  const isAllowed = await requireAdmin();
  if (!isAllowed) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const { rates } = body as { rates?: { crypto_currency: string; fiat_currency: string; rate: number }[] };

  if (!Array.isArray(rates) || rates.length === 0) {
    return NextResponse.json({ error: "No rates provided." }, { status: 400 });
  }

  let updated = 0;
  for (const r of rates) {
    if (!CRYPTO_CURRENCIES.includes(r.crypto_currency)) continue;
    if (!FIAT_CURRENCIES.some((f) => f.code === r.fiat_currency)) continue;
    const rate = Number(r.rate);
    if (!Number.isFinite(rate) || rate <= 0) continue;

    await dbQuery(
      `INSERT INTO p2p_currency_rates (crypto_currency, fiat_currency, rate, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (crypto_currency, fiat_currency)
       DO UPDATE SET rate = $3, updated_at = NOW()`,
      [r.crypto_currency, r.fiat_currency, rate]
    );
    updated++;
  }

  return NextResponse.json({ ok: true, updated });
}
