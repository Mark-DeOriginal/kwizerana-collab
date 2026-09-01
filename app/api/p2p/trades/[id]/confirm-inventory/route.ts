import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { confirmInventory } from "@/lib/p2p/trades";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
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

  const declaredBalance = Number(body.declared_balance);

  if (!Number.isFinite(declaredBalance) || declaredBalance < 0) {
    return NextResponse.json({ error: "Enter a valid balance." }, { status: 400 });
  }

  try {
    const trade = await confirmInventory(userId, params.id, declaredBalance);
    return NextResponse.json({ trade });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to confirm inventory." }, { status: 400 });
  }
}
