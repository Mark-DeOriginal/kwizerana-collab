import { NextResponse } from "next/server";
import { ensureP2PSeeded } from "@/lib/p2p/seed";
import { listSupportedMethods } from "@/lib/p2p/payment-methods";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureP2PSeeded();
  const methods = await listSupportedMethods();
  return NextResponse.json({ methods });
}
