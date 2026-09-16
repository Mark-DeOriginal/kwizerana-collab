import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { addWallet, listWallets, setPrimaryWallet } from "@/lib/p2p/wallets";
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
  const makePrimary = body.make_primary === true;

  const validationError = validateWalletAddress(chain, address);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const wallet = await addWallet(userId, chain, address);
  if (!wallet) {
    return NextResponse.json({ error: "Unable to add wallet." }, { status: 500 });
  }

  if (makePrimary && !wallet.is_primary) {
    await setPrimaryWallet(userId, wallet.id);
    wallet.is_primary = true;
  }

  return NextResponse.json({ wallet }, { status: 201 });
}
