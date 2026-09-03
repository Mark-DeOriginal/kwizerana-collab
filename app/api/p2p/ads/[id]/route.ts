import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { updateAd, deleteAd } from "@/lib/p2p/ads";

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

  const patch: Parameters<typeof updateAd>[2] = {};
  if (body.price_value !== undefined) patch.price_value = Number(body.price_value);
  if (body.price_margin !== undefined) patch.price_margin = body.price_margin == null ? null : Number(body.price_margin);
  if (body.min_amount !== undefined) patch.min_amount = Number(body.min_amount);
  if (body.max_amount !== undefined) patch.max_amount = Number(body.max_amount);
  if (body.is_paused !== undefined) patch.is_paused = Boolean(body.is_paused);
  if (body.status !== undefined) patch.status = String(body.status);

  try {
    const ad = await updateAd(userId, params.id, patch);
    return NextResponse.json({ ad });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to update ad." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const ok = await deleteAd(userId, params.id);
    if (!ok) {
      return NextResponse.json({ error: "Ad not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to delete ad." }, { status: 400 });
  }
}
