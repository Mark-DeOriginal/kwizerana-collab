import { NextResponse } from "next/server";
import { listSupportedMethods } from "@/lib/p2p/payment-methods";

export const dynamic = "force-dynamic";

export async function GET() {
  const methods = await listSupportedMethods();
  return NextResponse.json({ methods });
}
