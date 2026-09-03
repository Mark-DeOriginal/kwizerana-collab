import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { listMyAds, createAd } from "@/lib/p2p/ads";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const ads = await listMyAds(userId);
  return NextResponse.json({ ads });
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

  const ad_type = String(body.ad_type ?? "");
  const crypto_currency = String(body.crypto_currency ?? "").trim().toUpperCase();
  const fiat_currency = String(body.fiat_currency ?? "").trim().toUpperCase();
  const price_type = String(body.price_type ?? "fixed");
  const price_value = Number(body.price_value);
  const price_margin = body.price_margin == null ? null : Number(body.price_margin);
  const min_amount = Number(body.min_amount);
  const max_amount = Number(body.max_amount);
  const payment_method_ids = Array.isArray(body.payment_method_ids)
    ? body.payment_method_ids.map((id) => String(id))
    : [];

  if (ad_type !== "buy" && ad_type !== "sell") {
    return NextResponse.json({ error: "Choose an ad type." }, { status: 400 });
  }
  if (!crypto_currency || !fiat_currency) {
    return NextResponse.json({ error: "Choose crypto and fiat currencies." }, { status: 400 });
  }
  if (!Number.isFinite(price_value) || price_value <= 0) {
    return NextResponse.json({ error: "Enter a valid price." }, { status: 400 });
  }
  if (!Number.isFinite(min_amount) || !Number.isFinite(max_amount) || min_amount < 0 || max_amount <= min_amount) {
    return NextResponse.json({ error: "Enter a valid amount range." }, { status: 400 });
  }

  try {
    const ad = await createAd(userId, {
      ad_type,
      crypto_currency,
      fiat_currency,
      price_type,
      price_value,
      price_margin: price_margin == null || !Number.isFinite(price_margin) ? null : price_margin,
      min_amount,
      max_amount,
      payment_method_ids
    });
    return NextResponse.json({ ad }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to create ad." }, { status: 400 });
  }
}
