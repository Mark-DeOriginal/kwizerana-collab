import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { hasPermission, isAdminEmail } from "@/lib/roles";
import { resolveDispute, type DisputeResolution } from "@/lib/p2p/disputes";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const allowDevAdmin = process.env.NODE_ENV !== "production" && !process.env.GOOGLE_CLIENT_ID;
  const isAllowed = allowDevAdmin || isAdminEmail(session?.user?.email) ||
    hasPermission(session?.user?.role ?? "member", session?.user?.permissions ?? [], "view_dashboard");
  if (!isAllowed) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const adminId = session?.user?.id;
  if (!adminId) {
    return NextResponse.json({ error: "Admin identity missing." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const resolution = String(body.resolution ?? "");
  const valid: DisputeResolution[] = ["release_buyer", "refund_seller", "split"];
  if (!valid.includes(resolution as DisputeResolution)) {
    return NextResponse.json({ error: "Invalid resolution." }, { status: 400 });
  }

  try {
    await resolveDispute(adminId, params.id, resolution as DisputeResolution);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to resolve dispute." }, { status: 400 });
  }
}
