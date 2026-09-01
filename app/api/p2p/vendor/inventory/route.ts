import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { getVendorStatus, getVendorInventory, upsertVendorInventory, resolveInventoryTarget, ensureVendorListings } from "@/lib/p2p/vendor";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const status = await getVendorStatus(userId);
  if (!status.isVendor) {
    return NextResponse.json({ error: "Only vendors can manage inventory." }, { status: 403 });
  }

  const url = new URL(request.url);
  const requestedId = url.searchParams.get("user_id");
  const { targetId, managedVendors } = await resolveInventoryTarget(userId, requestedId);

  const inventory = await getVendorInventory(targetId);
  return NextResponse.json({
    inventory,
    managed_vendors: managedVendors.length > 0 ? managedVendors : undefined
  });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const status = await getVendorStatus(userId);
  if (!status.isVendor) {
    return NextResponse.json({ error: "Only vendors can manage inventory." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const requestedId = body.user_id ? String(body.user_id) : undefined;

  const { targetId, managedVendors } = await resolveInventoryTarget(userId, requestedId);

  const updates: { code: string; value: number }[] = [];

  if (body.balances && typeof body.balances === "object" && !Array.isArray(body.balances)) {
    for (const [code, raw] of Object.entries(body.balances as Record<string, unknown>)) {
      const c = String(code).trim().toUpperCase();
      const v = Number(raw);
      if (!c) continue;
      if (!Number.isFinite(v) || v < 0) {
        return NextResponse.json({ error: `Enter a valid ${c} amount.` }, { status: 400 });
      }
      updates.push({ code: c, value: v });
    }
    if (updates.length === 0) {
      return NextResponse.json({ error: "Enter an amount for at least one token." }, { status: 400 });
    }
  } else {
    const cryptoCurrency = String(body.crypto_currency ?? "").trim().toUpperCase();
    const declaredBalance = Number(body.declared_balance);
    if (!cryptoCurrency) {
      return NextResponse.json({ error: "Choose a crypto currency." }, { status: 400 });
    }
    if (!Number.isFinite(declaredBalance) || declaredBalance < 0) {
      return NextResponse.json({ error: "Enter a valid balance." }, { status: 400 });
    }
    updates.push({ code: cryptoCurrency, value: declaredBalance });
  }

  for (const u of updates) {
    await upsertVendorInventory(targetId, u.code, u.value);
  }

  // Ensure the vendor actually has listings for the currencies they trade,
  // so declaring a balance is enough to appear on the trade page.
  await ensureVendorListings(targetId);

  const inventory = await getVendorInventory(targetId);
  return NextResponse.json({
    inventory,
    managed_vendors: managedVendors.length > 0 ? managedVendors : undefined
  });
}