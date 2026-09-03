import { NextResponse } from "next/server";
import { listOffers } from "@/lib/p2p/offers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const side = url.searchParams.get("side") === "sell" ? "sell" : "buy";
  const asset = url.searchParams.get("asset") ?? "USDT";
  const fiat = url.searchParams.get("fiat") ?? "USD";

  const offers = await listOffers({ side, asset, fiat });
  return NextResponse.json({ offers });
}
