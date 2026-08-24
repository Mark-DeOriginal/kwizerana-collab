import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { removeWallet, setPrimaryWallet } from "@/lib/p2p/wallets";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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

  if (body.action === "set_primary") {
    const ok = await setPrimaryWallet(userId, params.id);
    if (!ok) {
      return NextResponse.json({ error: "Wallet not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const ok = await removeWallet(userId, params.id);
  if (!ok) {
    return NextResponse.json({ error: "Wallet not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
