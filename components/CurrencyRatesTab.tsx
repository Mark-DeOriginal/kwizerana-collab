"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { friendlyError, readJson } from "@/lib/client-request";

type CurrencyRateRow = {
  crypto_currency: string;
  fiat_currency: string;
  rate: number;
  updated_at: string;
};

const CRYPTO_LIST = ["USDT", "USDC"];
const FIAT_LIST = ["USD", "NGN", "KES", "GHS", "ZAR", "UGX", "EUR", "GBP", "CAD", "INR", "PHP", "VND", "THB", "AED", "SAR"];

function relativeTime(dateStr: string) {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function CurrencyRatesTab() {
  const [rates, setRates] = useState<CurrencyRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});

  const loadRates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/rates");
      const data = await readJson<{ rates?: CurrencyRateRow[]; error?: string }>(res);
      if (!res.ok) throw new Error(data?.error ?? "Failed to load rates.");
      const list = data?.rates ?? [];
      setRates(list);
      const d: Record<string, string> = {};
      for (const r of list) {
        d[`${r.crypto_currency}:${r.fiat_currency}`] = String(r.rate);
      }
      setDraft(d);
    } catch (err: unknown) {
      setError(friendlyError(err, "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRates();
  }, [loadRates]);

  function updateDraft(crypto: string, fiat: string, value: string) {
    setDraft((prev) => ({ ...prev, [`${crypto}:${fiat}`]: value }));
  }

  async function saveRates() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload: { crypto_currency: string; fiat_currency: string; rate: number }[] = [];
      for (const crypto of CRYPTO_LIST) {
        for (const fiat of FIAT_LIST) {
          const val = draft[`${crypto}:${fiat}`];
          const rate = Number(val);
          if (Number.isFinite(rate) && rate > 0) {
            payload.push({ crypto_currency: crypto, fiat_currency: fiat, rate });
          }
        }
      }
      if (payload.length === 0) {
        setError("No valid rates to save.");
        return;
      }
      const res = await fetch("/api/admin/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rates: payload })
      });
      const data = await readJson<{ error?: string; updated?: number }>(res);
      if (!res.ok) throw new Error(data?.error ?? "Failed to save rates.");
      setSuccess(`Updated ${data?.updated ?? 0} rates. Changes take effect immediately.`);
      setTimeout(() => setSuccess(""), 6000);
      await loadRates();
    } catch (err: unknown) {
      setError(friendlyError(err, "Something went wrong."));
    } finally {
      setSaving(false);
    }
  }

  async function autoRefresh() {
    setRefreshing(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/rates/refresh", { method: "POST" });
      const data = await readJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data?.error ?? "Failed to fetch rates from CoinGecko.");
      setSuccess("Rates auto-updated from CoinGecko. Changes take effect immediately.");
      setTimeout(() => setSuccess(""), 6000);
      await loadRates();
    } catch (err: unknown) {
      setError(friendlyError(err, "Something went wrong."));
    } finally {
      setRefreshing(false);
    }
  }

  const latestUpdatedAt = rates.reduce((latest, r) => {
    if (!r.updated_at) return latest;
    const t = new Date(r.updated_at).getTime();
    return t > latest ? t : latest;
  }, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Currency Rates</h2>
          <p className="mt-0.5 text-xs text-muted">
            Rates are quoted as fiat units per 1 USDT/USDC. Edit manually or auto-refresh from CoinGecko.
            {latestUpdatedAt > 0 && (
              <span className="ml-2 text-ocean font-semibold">Last updated: {relativeTime(new Date(latestUpdatedAt).toISOString())}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void autoRefresh()}
            disabled={refreshing}
            className="flex h-9 items-center gap-2 border border-ocean bg-white px-4 text-xs font-bold text-ocean transition-colors hover:bg-ocean/5 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97]"
          >
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Auto-refresh (CoinGecko)
          </button>
          <button
            onClick={() => void saveRates()}
            disabled={saving}
            className="flex h-9 items-center gap-2 bg-ink px-4 text-xs font-bold text-white transition-colors hover:bg-ocean disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97]"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save changes
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 border border-coral/30 bg-coral/5 px-4 py-3 text-sm text-coral">{error}</div>
      )}
      {success && (
        <div className="mb-4 border border-moss/30 bg-moss/5 px-4 py-3 text-sm text-moss">{success}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      ) : (
        <div className="overflow-x-auto border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-panel">
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-muted">Crypto</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-muted">Fiat</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-muted">Rate (per 1 USDT/USDC)</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-muted">Last updated</th>
              </tr>
            </thead>
            <tbody>
              {CRYPTO_LIST.map((crypto) =>
                FIAT_LIST.map((fiat) => {
                  const key = `${crypto}:${fiat}`;
                  const existing = rates.find((r) => r.crypto_currency === crypto && r.fiat_currency === fiat);
                  const hasChanged = draft[key] !== undefined && draft[key] !== String(existing?.rate ?? "");
                  return (
                    <tr key={key} className="border-b border-line last:border-0 hover:bg-panel/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="font-bold text-ink">{crypto}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-semibold text-muted">{fiat}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={draft[key] ?? ""}
                          onChange={(e) => updateDraft(crypto, fiat, e.target.value)}
                          className={`h-9 w-32 border bg-transparent px-3 text-sm font-semibold outline-none transition-colors ${
                            hasChanged
                              ? "border-ocean ring-1 ring-ocean/30 text-ocean"
                              : "border-line focus:border-ocean"
                          }`}
                          placeholder="0.00"
                        />
                        {hasChanged && (
                          <span className="ml-2 text-[10px] font-bold text-ocean">modified</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted">
                        {existing?.updated_at ? relativeTime(existing.updated_at) : <span className="text-coral">Not set</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
