import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { getSocialState, toggleFavorite, toggleBlock } from "@/lib/p2p/social";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  return NextResponse.json(await getSocialState(userId));
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  let vendorId = "";
  try {
    const body = await request.json();
    vendorId = String(body.vendorId ?? body.vendor_id ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!vendorId) {
    return NextResponse.json({ error: "Vendor id is required." }, { status: 400 });
  }

  try {
    if (action === "block") {
      const blocked = await toggleBlock(userId, vendorId);
      return NextResponse.json({ blocked });
    }
    const favorite = await toggleFavorite(userId, vendorId);
    return NextResponse.json({ favorite });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to update." }, { status: 400 });
  }
}
