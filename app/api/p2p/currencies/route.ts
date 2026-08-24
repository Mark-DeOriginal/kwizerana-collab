import { NextResponse } from "next/server";
import { ensureP2PSeeded } from "@/lib/p2p/seed";
import { listCurrencies, listRates } from "@/lib/p2p/currencies";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureP2PSeeded();
  const [currencies, rates] = await Promise.all([listCurrencies(), listRates()]);
  return NextResponse.json({ currencies, rates });
}
