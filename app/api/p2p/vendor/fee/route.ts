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

  const rows = await dbQuery<{ vendor_fee_percent: string }>(
    `SELECT vendor_fee_percent::TEXT AS vendor_fee_percent FROM users WHERE id = $1`,
    [targetId]
  );

  return NextResponse.json({
    vendor_fee_percent: Number(rows[0]?.vendor_fee_percent ?? 0),
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

  const feePercent = Number(body.vendor_fee_percent);
  if (!Number.isFinite(feePercent) || feePercent < 0 || feePercent > 50) {
    return NextResponse.json({ error: "Fee must be between 0% and 50%." }, { status: 400 });
  }

  const requestedId = body.user_id ? String(body.user_id) : undefined;
  const { targetId, managedVendors } = await resolveInventoryTarget(userId, requestedId);

  await dbQuery(
    `UPDATE users SET vendor_fee_percent = $2, updated_at = NOW() WHERE id = $1`,
    [targetId, feePercent]
  );

  return NextResponse.json({
    ok: true,
    vendor_fee_percent: feePercent,
    managed_vendors: managedVendors.length > 0 ? managedVendors : undefined
  });
}
