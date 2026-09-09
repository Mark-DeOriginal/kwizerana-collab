"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, RefreshCw, Save } from "lucide-react";
import { friendlyError, readJson } from "@/lib/client-request";

type CurrencyRateRow = {
  crypto_currency: string;
  fiat_currency: string;
  rate: number;
  updated_at: string;
};

const CRYPTO_LIST = ["USDT", "USDC"];
const FIAT_LIST = ["USD", "NGN", "KES", "GHS", "ZAR", "UGX", "EUR", "GBP", "CAD", "INR", "PHP", "VND", "THB", "AED", "SAR"];

function formatUpdatedAt(dateStr: string) {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function CurrencyRatesTab() {
  const [rates, setRates] = useState<CurrencyRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [ratesUpdated, setRatesUpdated] = useState(false);
  const [ratesSaved, setRatesSaved] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const saveResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadRates = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRates();
  }, [loadRates]);

  useEffect(() => () => {
    if (saveResetTimer.current) clearTimeout(saveResetTimer.current);
  }, []);

  function confirmSaved() {
    if (saveResetTimer.current) clearTimeout(saveResetTimer.current);
    setRatesSaved(true);
    saveResetTimer.current = setTimeout(() => {
      setRatesSaved(false);
      saveResetTimer.current = null;
    }, 1000);
  }

  function updateDraft(crypto: string, fiat: string, value: string) {
    setDraft((prev) => ({ ...prev, [`${crypto}:${fiat}`]: value }));
  }

  async function saveRates() {
    setSaving(true);
    setRatesSaved(false);
    setError("");
    try {
      const payload: { crypto_currency: string; fiat_currency: string; rate: number }[] = [];
      for (const crypto of CRYPTO_LIST) {
        for (const fiat of FIAT_LIST) {
          const val = draft[`${crypto}:${fiat}`];
          const rate = Number(val);
          const existing = rates.find((item) => item.crypto_currency === crypto && item.fiat_currency === fiat);
          if (Number.isFinite(rate) && rate > 0 && rate !== existing?.rate) {
            payload.push({ crypto_currency: crypto, fiat_currency: fiat, rate });
          }
        }
      }
      if (payload.length === 0) {
        confirmSaved();
        return;
      }
      const res = await fetch("/api/admin/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rates: payload })
      });
      const data = await readJson<{ error?: string; updated?: number }>(res);
      if (!res.ok) throw new Error(data?.error ?? "Failed to save rates.");
      await loadRates({ silent: true });
      confirmSaved();
    } catch (err: unknown) {
      setError(friendlyError(err, "Something went wrong."));
    } finally {
      setSaving(false);
    }
  }

  async function autoRefresh() {
    setRefreshing(true);
    setRatesUpdated(false);
    setError("");
    try {
      const res = await fetch("/api/admin/rates/refresh", { method: "POST" });
      const data = await readJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data?.error ?? "Unable to update rates.");
      await loadRates({ silent: true });
      setRatesUpdated(true);
      setTimeout(() => setRatesUpdated(false), 3000);
    } catch {
      setError("Unable to update rates. Please try again.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Currency Rates</h2>
          <p className="mt-0.5 text-xs text-muted">
            Rates are quoted as fiat units per 1 USDT/USDC. Edit them manually or fetch the latest available rates.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void autoRefresh()}
            disabled={refreshing}
            className="flex h-9 items-center gap-2 border border-ocean bg-white px-4 text-xs font-bold text-ocean transition-colors hover:bg-ocean/5 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97]"
          >
            {ratesUpdated ? <Check className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {ratesUpdated ? "Updated" : "Update rates"}
          </button>
          <button
            onClick={() => void saveRates()}
            disabled={saving}
            className="flex h-9 items-center gap-2 bg-ink px-4 text-xs font-bold text-white transition-colors hover:bg-ocean disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97]"
          >
            {ratesSaved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {ratesSaved ? "Saved" : "Save changes"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 border border-coral/30 bg-coral/5 px-4 py-3 text-sm text-coral">{error}</div>
      )}
      {loading ? (
        <div className="flex min-h-72 items-center justify-center border border-line bg-white" role="status" aria-label="Loading currency rates">
          <Loader2 className="h-6 w-6 animate-spin text-ocean" aria-hidden="true" />
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
                              ? "border-ocean text-ocean"
                              : "border-line focus:border-ocean"
                          }`}
                          placeholder="0.00"
                        />
                        {hasChanged && (
                          <span className="ml-2 text-[10px] font-bold text-ocean">modified</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted">
                        {existing?.updated_at ? formatUpdatedAt(existing.updated_at) : <span className="text-coral">Not set</span>}
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
