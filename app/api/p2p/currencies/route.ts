import { NextResponse } from "next/server";
import { listCurrencies, listRates } from "@/lib/p2p/currencies";

export const dynamic = "force-dynamic";

export async function GET() {
  const [currencies, rates] = await Promise.all([listCurrencies(), listRates()]);
  return NextResponse.json({ currencies, rates });
}
