"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ImagePlus, Loader2, Scale, Send, X } from "lucide-react";
import { readJson } from "@/lib/client-request";
import { compressImage } from "@/lib/p2p/compress-image";
import type { DisputeDetail, DisputeEvidence } from "@/lib/p2p/disputes";

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
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    await fetch("/api/p2p/disputes", { cache: "no-store" })
      .then((res) => readJson<{ disputes: DisputeDetail[] }>(res))
      .then((data) => setDisputes(data?.disputes ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    void load();
  }, []);

  async function submitEvidence(disputeId: string) {
    if (!description.trim() && !image) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/p2p/disputes/${disputeId}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: description.trim(), image_url: image })
    });
    const data = await readJson<{ error?: string }>(response);
    setBusy(false);
    if (!response.ok) {
      setError(data?.error ?? "Unable to submit evidence.");
      return;
    }
    setRespondingTo(null);
    setDescription("");
    setImage(null);
    await load();
  }

  return (
    <div className="px-4 py-8 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">P2P Marketplace</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Dispute center</h1>
        <p className="mt-1 text-sm text-muted">Review open cases, provide evidence, and track administrator decisions.</p>

        {error && <div className="mt-4 border border-coral/30 bg-coral/5 px-4 py-3 text-sm font-semibold text-coral">{error}</div>}

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
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <EvidenceList
                    title="Your evidence"
                    evidence={d.my_side === "buyer" ? d.evidence_buyer : d.evidence_seller}
                  />
                  <EvidenceList
                    title="Counterparty evidence"
                    evidence={d.my_side === "buyer" ? d.evidence_seller : d.evidence_buyer}
                  />
                </div>
                {d.status === "open" && (
                  respondingTo === d.id ? (
                    <div className="mt-4 space-y-3 border border-line bg-panel p-3">
                      <div>
                        <p className="text-sm font-semibold">Add evidence</p>
                        <p className="mt-0.5 text-xs text-muted">Provide factual details, a receipt, or a relevant screenshot for the administrator.</p>
                      </div>
                      <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        rows={3}
                        maxLength={2000}
                        placeholder="Explain what happened and include useful payment references or timestamps."
                        className="w-full border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ocean"
                      />
                      {image ? (
                        <div className="relative w-fit border border-line bg-white p-2">
                          <img src={image} alt="Evidence preview" className="max-h-44 max-w-full object-contain" />
                          <button type="button" onClick={() => setImage(null)} className="absolute right-2 top-2 grid h-7 w-7 place-items-center bg-ink text-white" aria-label="Remove evidence image">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex h-20 cursor-pointer items-center justify-center gap-2 border border-dashed border-line bg-white text-sm font-semibold text-muted transition-colors hover:border-ocean hover:text-ink">
                          <ImagePlus className="h-4 w-4" /> Attach receipt or screenshot
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={async (event) => {
                              const file = event.target.files?.[0];
                              if (!file) return;
                              try {
                                setImage(await compressImage(file));
                              } catch {
                                setError("Unable to prepare that image. Try a smaller JPG, PNG, or WebP file.");
                              }
                            }}
                          />
                        </label>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => void submitEvidence(d.id)} disabled={busy || (!description.trim() && !image)} className="flex h-10 items-center gap-2 bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-50">
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit evidence
                        </button>
                        <button type="button" onClick={() => { setRespondingTo(null); setDescription(""); setImage(null); }} disabled={busy} className="h-10 border border-line bg-white px-4 text-sm font-semibold text-muted hover:text-ink disabled:opacity-50">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setRespondingTo(d.id); setError(""); }} className="mt-4 h-10 border border-ink px-4 text-sm font-semibold text-ink transition-colors hover:bg-ink hover:text-white">
                      Add evidence
                    </button>
                  )
                )}
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

function EvidenceList({ title, evidence }: { title: string; evidence: DisputeEvidence[] }) {
  return (
    <section className="border border-line bg-panel p-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-muted">{title}</h2>
      {evidence.length === 0 ? (
        <p className="mt-2 text-xs text-muted">No evidence submitted yet.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {evidence.map((item) => (
            <article key={item.id} className="bg-white p-2 text-xs">
              {item.description && <p className="whitespace-pre-wrap leading-5 text-ink">{item.description}</p>}
              {item.image_url && <a href={item.image_url} target="_blank" rel="noreferrer"><img src={item.image_url} alt="Submitted dispute evidence" className="mt-2 max-h-36 object-contain" /></a>}
              <p className="mt-1 text-[11px] text-muted">{timeAgo(item.created_at)}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
