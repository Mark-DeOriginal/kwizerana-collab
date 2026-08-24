import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { addWallet, listWallets } from "@/lib/p2p/wallets";
import { validateWalletAddress } from "@/lib/p2p/wallets-shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const wallets = await listWallets(userId);
  return NextResponse.json({ wallets });
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

  const chain = String(body.chain ?? "");
  const address = String(body.address ?? "").trim();

  const validationError = validateWalletAddress(chain, address);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const wallet = await addWallet(userId, chain, address);
  if (!wallet) {
    return NextResponse.json({ error: "Unable to add wallet." }, { status: 500 });
  }

  return NextResponse.json({ wallet }, { status: 201 });
}
