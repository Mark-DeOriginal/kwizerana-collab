import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { getVendorStatus, resolveInventoryTarget } from "@/lib/p2p/vendor";
import { dbQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const status = await getVendorStatus(userId);
  if (!status.isVendor) return NextResponse.json({ error: "Only vendors can manage fees." }, { status: 403 });

  const url = new URL(request.url);
  const requestedId = url.searchParams.get("user_id");
  const { targetId, managedVendors } = await resolveInventoryTarget(userId, requestedId);

  const rows = await dbQuery<{ vendor_buy_fee_percent: string | null; vendor_sell_fee_percent: string | null; vendor_fee_percent: string }>(
    `SELECT vendor_buy_fee_percent::TEXT AS vendor_buy_fee_percent,
            vendor_sell_fee_percent::TEXT AS vendor_sell_fee_percent,
            vendor_fee_percent::TEXT AS vendor_fee_percent
     FROM users WHERE id = $1`,
    [targetId]
  );

  const row = rows[0];
  const legacyFee = Number(row?.vendor_fee_percent ?? 0);
  return NextResponse.json({
    vendor_buy_fee_percent: row?.vendor_buy_fee_percent != null ? Number(row.vendor_buy_fee_percent) : legacyFee,
    vendor_sell_fee_percent: row?.vendor_sell_fee_percent != null ? Number(row.vendor_sell_fee_percent) : legacyFee,
    managed_vendors: managedVendors.length > 0 ? managedVendors : undefined
  });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const status = await getVendorStatus(userId);
  if (!status.isVendor) return NextResponse.json({ error: "Only vendors can manage fees." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const buyFee = body.vendor_buy_fee_percent != null ? Number(body.vendor_buy_fee_percent) : null;
  const sellFee = body.vendor_sell_fee_percent != null ? Number(body.vendor_sell_fee_percent) : null;

  if (buyFee != null && (!Number.isFinite(buyFee) || buyFee < 0 || buyFee > 50)) {
    return NextResponse.json({ error: "Buy fee must be between 0% and 50%." }, { status: 400 });
  }
  if (sellFee != null && (!Number.isFinite(sellFee) || sellFee < 0 || sellFee > 50)) {
    return NextResponse.json({ error: "Sell fee must be between 0% and 50%." }, { status: 400 });
  }

  const requestedId = body.user_id ? String(body.user_id) : undefined;
  const { targetId, managedVendors } = await resolveInventoryTarget(userId, requestedId);

  await dbQuery(
    `UPDATE users SET vendor_buy_fee_percent = COALESCE($2, vendor_fee_percent),
                      vendor_sell_fee_percent = COALESCE($3, vendor_fee_percent),
                      updated_at = NOW()
     WHERE id = $1`,
    [targetId, buyFee, sellFee]
  );

  return NextResponse.json({
    ok: true,
    vendor_buy_fee_percent: buyFee ?? 0,
    vendor_sell_fee_percent: sellFee ?? 0,
    managed_vendors: managedVendors.length > 0 ? managedVendors : undefined
  });
}
