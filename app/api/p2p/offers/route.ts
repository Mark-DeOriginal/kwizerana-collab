import { NextResponse } from "next/server";
import { ensureP2PSeeded } from "@/lib/p2p/seed";
import { listOffers } from "@/lib/p2p/offers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureP2PSeeded();

  const url = new URL(request.url);
  const side = url.searchParams.get("side") === "sell" ? "sell" : "buy";
  const asset = url.searchParams.get("asset") ?? "USDT";
  const fiat = url.searchParams.get("fiat") ?? "USD";

  const offers = await listOffers({ side, asset, fiat });
  return NextResponse.json({ offers });
}
