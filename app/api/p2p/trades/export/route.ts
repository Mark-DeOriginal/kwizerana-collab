import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { listTrades } from "@/lib/p2p/trades";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/roles";

export const dynamic = "force-dynamic";

function csvCell(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const session = await getServerSession(authOptions);
  const isSuperAdmin = isAdminEmail(session?.user?.email);
  const trades = await listTrades(userId, isSuperAdmin);
  const history = trades.filter((t) => ["completed", "cancelled", "expired"].includes(t.status));

  const header = ["Date", "Type", "Asset", "Amount", "Fiat", "Rate", "Counterparty", "Status", "Reference"];
  const rows = history.map((t) => {
    const counterparty = t.my_role === "buyer" ? t.seller_name : t.buyer_name;
    return [
      new Date(t.created_at).toISOString(),
      t.my_role === "buyer" ? "Buy" : "Sell",
      t.crypto_currency,
      t.crypto_amount,
      `${t.fiat_amount} ${t.fiat_currency}`,
      t.price_at_trade,
      counterparty,
      t.status,
      t.trade_ref
    ];
  });

  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kwizerana-trade-history.csv"`
    }
  });
}
