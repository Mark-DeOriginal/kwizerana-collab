"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Scale } from "lucide-react";
import { readJson } from "@/lib/client-request";
import type { DisputeDetail } from "@/lib/p2p/disputes";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

const RESOLUTION_LABELS: Record<string, string> = {
  release_buyer: "Crypto released to buyer",
  refund_seller: "Escrow refunded to seller",
  split: "Funds split between parties"
};

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<DisputeDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/p2p/disputes", { cache: "no-store" })
      .then((res) => readJson<{ disputes: DisputeDetail[] }>(res))
      .then((data) => setDisputes(data?.disputes ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-4 py-8 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">P2P Marketplace</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Dispute center</h1>
        <p className="mt-1 text-sm text-muted">Track the status of your disputes.</p>

        <div className="mt-6 space-y-2">
          {loading ? (
            <div className="flex items-center gap-3 border border-line bg-white p-6 text-sm text-muted">
              <Loader2 className="h-5 w-5 animate-spin text-ocean" /> Loading disputes…
            </div>
          ) : disputes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-line bg-panel/60 px-4 py-12 text-center">
              <Scale className="h-8 w-8 text-muted" />
              <p className="mt-3 text-sm font-semibold">No disputes</p>
              <p className="mt-1 text-sm text-muted">If a trade goes wrong, you can open a dispute from the order page.</p>
            </div>
          ) : (
            disputes.map((d) => (
              <div key={d.id} className="border border-line bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted">{d.trade_ref}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${d.status === "open" ? "bg-coral/15 text-coral" : "bg-mint text-moss"}`}>{d.status}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold">
                      {d.my_side === "buyer" ? "You bought" : "You sold"} {d.crypto_amount} {d.crypto_currency} · {d.counterparty}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">{d.reason}</p>
                    {d.resolution && <p className="mt-1 text-xs font-semibold text-moss">{RESOLUTION_LABELS[d.resolution] ?? d.resolution}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-muted">{timeAgo(d.created_at)}</span>
                </div>
                <div className="mt-3 border-t border-line pt-2">
                  <Link href={`/p2p-marketplace/trade?trade=${d.trade_id}`} className="text-xs font-semibold text-ocean hover:underline">View order</Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
