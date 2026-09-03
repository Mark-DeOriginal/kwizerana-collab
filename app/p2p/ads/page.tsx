"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Pause, Play, Pencil, Plus, Trash2, X } from "lucide-react";
import { readJson } from "@/lib/client-request";
import type { P2PAd } from "@/lib/p2p/ads";
import type { UserPaymentMethod } from "@/lib/p2p/payment-methods-shared";
import { CRYPTO_CURRENCIES } from "@/lib/p2p/currencies-shared";

const FIATS = ["USD", "NGN", "KES", "GHS", "ZAR", "UGX", "GBP", "EUR", "CAD", "INR", "AED", "SAR", "PHP", "VND", "THB"];

export default function MyAdsPage() {
  const [ads, setAds] = useState<P2PAd[]>([]);
  const [methods, setMethods] = useState<UserPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // form state
  const [adType, setAdType] = useState<"buy" | "sell">("sell");
  const [crypto, setCrypto] = useState("USDT");
  const [fiat, setFiat] = useState("USD");
  const [priceType, setPriceType] = useState<"fixed" | "floating">("fixed");
  const [price, setPrice] = useState("");
  const [margin, setMargin] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [adsRes, pmRes] = await Promise.all([
      fetch("/api/p2p/ads", { cache: "no-store" }),
      fetch("/api/p2p/payment-methods", { cache: "no-store" })
    ]);
    const adsData = await readJson<{ ads: P2PAd[] }>(adsRes);
    const pmData = await readJson<{ methods: UserPaymentMethod[] }>(pmRes);
    if (adsRes.ok && adsData) setAds(adsData.ads ?? []);
    if (pmRes.ok && pmData) setMethods(pmData.methods ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setAdType("sell");
    setCrypto("USDT");
    setFiat("USD");
    setPriceType("fixed");
    setPrice("");
    setMargin("");
    setMin("");
    setMax("");
    setSelectedMethods([]);
    setEditingId(null);
    setShowForm(false);
  }

  async function submitCreate() {
    setError("");
    const res = await fetch("/api/p2p/ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ad_type: adType,
        crypto_currency: crypto,
        fiat_currency: fiat,
        price_type: priceType,
        price_value: Number(price),
        price_margin: priceType === "floating" ? Number(margin) : null,
        min_amount: Number(min),
        max_amount: Number(max),
        payment_method_ids: selectedMethods
      })
    });
    const data = await readJson<{ error?: string }>(res);
    if (!res.ok) {
      setError(data?.error ?? "Unable to create ad.");
      return;
    }
    resetForm();
    void load();
  }

  async function submitEdit(id: string) {
    setError("");
    setBusyId(id);
    const res = await fetch(`/api/p2p/ads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        price_value: Number(price),
        price_margin: priceType === "floating" ? Number(margin) : null,
        min_amount: Number(min),
        max_amount: Number(max)
      })
    });
    setBusyId(null);
    if (!res.ok) {
      setError("Unable to update ad.");
      return;
    }
    resetForm();
    void load();
  }

  async function togglePause(ad: P2PAd) {
    setBusyId(ad.id);
    await fetch(`/api/p2p/ads/${ad.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_paused: !ad.is_paused })
    });
    setBusyId(null);
    void load();
  }

  async function remove(id: string) {
    setBusyId(id);
    await fetch(`/api/p2p/ads/${id}`, { method: "DELETE" });
    setBusyId(null);
    setConfirmDelete(null);
    void load();
  }

  function startEdit(ad: P2PAd) {
    setEditingId(ad.id);
    setShowForm(true);
    setAdType(ad.ad_type);
    setCrypto(ad.crypto_currency);
    setFiat(ad.fiat_currency);
    setPriceType(ad.price_type === "floating" ? "floating" : "fixed");
    setPrice(String(ad.price_value));
    setMargin(ad.price_margin == null ? "" : String(ad.price_margin));
    setMin(String(ad.min_amount));
    setMax(String(ad.max_amount));
    setSelectedMethods(ad.payment_method_ids);
  }

  return (
    <div className="px-4 py-8 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">P2P Marketplace</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">My ads</h1>
            <p className="mt-1 text-sm text-muted">Create and manage your buy and sell offers.</p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="flex h-10 items-center gap-1.5 bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean">
            <Plus className="h-4 w-4" /> New ad
          </button>
        </div>

        {error && <p className="mt-4 text-sm font-semibold text-coral">{error}</p>}

        {showForm && (
          <div className="mt-4 border border-ocean/30 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{editingId ? "Edit ad" : "Create ad"}</p>
              <button onClick={resetForm} className="text-muted hover:text-ink"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Ad type</label>
                <div className="flex gap-2">
                  {(["sell", "buy"] as const).map((t) => (
                    <button key={t} onClick={() => setAdType(t)} className={`h-9 flex-1 border text-sm font-semibold capitalize ${adType === t ? "border-ink bg-ink text-white" : "border-line bg-white text-muted"}`}>
                      {t === "sell" ? "Sell" : "Buy"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Cryptocurrency</label>
                <select value={crypto} onChange={(e) => setCrypto(e.target.value)} className="h-9 w-full border border-line bg-white px-2 text-sm outline-none focus:border-ocean">
                  {CRYPTO_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Fiat currency</label>
                <select value={fiat} onChange={(e) => setFiat(e.target.value)} className="h-9 w-full border border-line bg-white px-2 text-sm outline-none focus:border-ocean">
                  {FIATS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Price type</label>
                <div className="flex gap-2">
                  {(["fixed", "floating"] as const).map((t) => (
                    <button key={t} onClick={() => setPriceType(t)} className={`h-9 flex-1 border text-sm font-semibold capitalize ${priceType === t ? "border-ink bg-ink text-white" : "border-line bg-white text-muted"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  {priceType === "floating" ? "Base price (1 crypto = )" : "Price (1 " + crypto + " = )"}
                </label>
                <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" step="any" className="h-9 w-full border border-line bg-white px-3 text-sm outline-none focus:border-ocean" />
              </div>
              {priceType === "floating" && (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Margin (%)</label>
                  <input value={margin} onChange={(e) => setMargin(e.target.value)} type="number" step="any" placeholder="e.g. 1 for +1%" className="h-9 w-full border border-line bg-white px-3 text-sm outline-none focus:border-ocean" />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Min amount ({fiat})</label>
                <input value={min} onChange={(e) => setMin(e.target.value)} type="number" min="0" step="any" className="h-9 w-full border border-line bg-white px-3 text-sm outline-none focus:border-ocean" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Max amount ({fiat})</label>
                <input value={max} onChange={(e) => setMax(e.target.value)} type="number" min="0" step="any" className="h-9 w-full border border-line bg-white px-3 text-sm outline-none focus:border-ocean" />
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Payment methods accepted</label>
              {methods.length === 0 ? (
                <p className="text-sm text-muted">No saved payment methods. <Link href="/account/payment-methods" className="text-ocean hover:underline">Add one</Link> first.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {methods.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMethods((prev) => (prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id]))}
                      className={`flex h-8 items-center gap-1.5 border px-3 text-xs font-semibold ${selectedMethods.includes(m.id) ? "border-ocean bg-mint/60 text-ink" : "border-line bg-white text-muted"}`}
                    >
                      {selectedMethods.includes(m.id) && <Check className="h-3.5 w-3.5 text-ocean" />}
                      {m.method_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => (editingId ? void submitEdit(editingId) : void submitCreate())}
                disabled={!price || !min || !max || Number(min) >= Number(max) || (priceType === "floating" && !margin)}
                className="flex h-10 items-center gap-1.5 bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-60"
              >
                {editingId ? "Save changes" : "Create ad"}
              </button>
              <button onClick={resetForm} className="h-10 border border-line px-4 text-sm font-semibold text-muted transition-colors hover:text-ink">Cancel</button>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-2">
          {loading ? (
            <div className="flex items-center gap-3 border border-line bg-white p-6 text-sm text-muted">
              <Loader2 className="h-5 w-5 animate-spin text-ocean" /> Loading ads…
            </div>
          ) : ads.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-line bg-panel/60 px-4 py-12 text-center">
              <p className="text-sm font-semibold">No ads yet</p>
              <p className="mt-1 text-sm text-muted">Create your first offer to start trading.</p>
            </div>
          ) : (
            ads.map((ad) => (
              <div key={ad.id} className="border border-line bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${ad.ad_type === "sell" ? "bg-moss/15 text-moss" : "bg-ocean/15 text-ocean"}`}>{ad.ad_type}</span>
                      <span className="font-semibold">{ad.crypto_currency}/{ad.fiat_currency}</span>
                      {ad.is_paused && <span className="text-xs font-semibold text-muted">· Paused</span>}
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      1 {ad.crypto_currency} = {ad.price_value} {ad.fiat_currency} · {ad.min_amount} – {ad.max_amount} {ad.fiat_currency}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button onClick={() => void togglePause(ad)} disabled={busyId === ad.id} className="flex h-8 items-center gap-1 border border-line bg-white px-2.5 text-xs font-semibold text-muted transition-colors hover:border-ocean hover:text-ink disabled:opacity-60">
                      {busyId === ad.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : ad.is_paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                      {ad.is_paused ? "Resume" : "Pause"}
                    </button>
                    <button onClick={() => startEdit(ad)} className="flex h-8 w-8 items-center justify-center border border-line bg-white text-muted transition-colors hover:border-ocean hover:text-ocean">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {confirmDelete === ad.id ? (
                      <button onClick={() => void remove(ad.id)} disabled={busyId === ad.id} className="flex h-8 items-center border border-coral bg-coral px-2.5 text-xs font-semibold text-white disabled:opacity-60">
                        {busyId === ad.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm?"}
                      </button>
                    ) : (
                      <button onClick={() => setConfirmDelete(ad.id)} className="flex h-8 w-8 items-center justify-center border border-line bg-white text-muted transition-colors hover:border-coral hover:text-coral">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
