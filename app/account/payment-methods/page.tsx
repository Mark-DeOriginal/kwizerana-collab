"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { readJson } from "@/lib/client-request";
import { COUNTRIES, countryLabel, PAYMENT_METHOD_CATEGORY_LABELS } from "@/lib/p2p/countries-shared";
import type { UserPaymentMethod } from "@/lib/p2p/payment-methods-shared";

type FormState = {
  countryCode: string;
  methodName: string;
  customBank: boolean;
  customBankName: string;
  accountHolderName: string;
  accountIdentifier: string;
  note: string;
};

const emptyForm: FormState = {
  countryCode: "",
  methodName: "",
  customBank: false,
  customBankName: "",
  accountHolderName: "",
  accountIdentifier: "",
  note: ""
};

const categoryOrder = ["bank", "mobile_money", "digital_wallet"] as const;

const categoryLabels = PAYMENT_METHOD_CATEGORY_LABELS as Record<string, string>;

function categoryDisplay(category: string): string {
  return categoryLabels[category] ?? category;
}

export default function PaymentMethodsPage() {
  const [methods, setMethods] = useState<UserPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const countries = useMemo(() => [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)), []);
  const selectedCountry = useMemo(() => countries.find((c) => c.code === form.countryCode) ?? null, [countries, form.countryCode]);

  const groupedMethods = useMemo(() => {
    if (!selectedCountry) return [];
    return categoryOrder
      .map((category) => ({
        category,
        options: selectedCountry.methods.filter((m) => m.category === category)
      }))
      .filter((group) => group.options.length > 0);
  }, [selectedCountry]);

  const load = useCallback(async () => {
    const res = await fetch("/api/p2p/payment-methods");
    const data = await readJson<{ methods: UserPaymentMethod[] }>(res);
    if (data?.methods) setMethods(data.methods);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setFormOpen(true);
  }

  function startEdit(method: UserPaymentMethod) {
    const details = method.details as { accountIdentifier?: string; note?: string; countryCode?: string };
    const countryCode = details.countryCode ?? "";
    const country = COUNTRIES.find((c) => c.code === countryCode);
    const isKnownMethod = country?.methods.some((m) => m.name === method.method_name);

    setEditingId(method.id);
    setForm({
      countryCode,
      methodName: isKnownMethod ? method.method_name : "",
      customBank: !isKnownMethod && method.method_type === "bank",
      customBankName: !isKnownMethod && method.method_type === "bank" ? method.method_name : "",
      accountHolderName: method.account_holder_name ?? "",
      accountIdentifier: details.accountIdentifier ?? "",
      note: details.note ?? ""
    });
    setError("");
    setFormOpen(true);
  }

  function selectCountry(code: string) {
    setForm((f) => ({ ...f, countryCode: code, methodName: "", customBank: false, customBankName: "" }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);

    let methodType: string;
    let methodName: string;

    if (form.customBank) {
      methodType = "bank";
      methodName = form.customBankName.trim();
    } else {
      const option = selectedCountry?.methods.find((m) => m.name === form.methodName);
      methodType = option?.category ?? "";
      methodName = form.methodName;
    }

    const payload = {
      method_type: methodType,
      method_name: methodName,
      account_holder_name: form.accountHolderName,
      details: {
        accountIdentifier: form.accountIdentifier,
        note: form.note,
        countryCode: form.countryCode,
        countryName: selectedCountry?.name ?? ""
      }
    };

    const res = await fetch(editingId ? `/api/p2p/payment-methods/${editingId}` : "/api/p2p/payment-methods", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await readJson<{ error?: string }>(res);
    setBusy(false);

    if (!res.ok) {
      setError(data?.error ?? "Unable to save.");
      return;
    }

    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    await load();
  }

  async function remove(id: string) {
    setError("");
    const res = await fetch(`/api/p2p/payment-methods/${id}`, { method: "DELETE" });
    if (res.ok) {
      setEditingId(null);
      setFormOpen(false);
      await load();
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm leading-6 text-muted">
          Add the payment methods you use to send and receive fiat. You can attach them to ads later.
        </p>
        <button onClick={startAdd} className="flex h-10 shrink-0 items-center gap-2 bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean">
          <Plus className="h-4 w-4" />
          Add method
        </button>
      </div>

      {formOpen && (
        <form onSubmit={submit} className="space-y-4 border border-line bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{editingId ? "Edit payment method" : "Add payment method"}</h3>
            <button type="button" onClick={() => setFormOpen(false)} className="text-muted transition-colors hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <label htmlFor="country" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Country / region
            </label>
            <select
              id="country"
              value={form.countryCode}
              onChange={(e) => selectCountry(e.target.value)}
              required
              className="h-11 w-full border border-line bg-white px-3 text-sm outline-none transition-colors focus:border-ocean"
            >
              <option value="" disabled>
                Select your country
              </option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {form.customBank ? (
            <div>
              <label htmlFor="customBankName" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                Bank name
              </label>
              <input
                id="customBankName"
                value={form.customBankName}
                onChange={(e) => setForm((f) => ({ ...f, customBankName: e.target.value }))}
                required
                className="h-11 w-full border border-line bg-white px-3 text-sm outline-none transition-colors focus:border-ocean"
                placeholder="Enter your bank's name"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="method" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                Payment method
              </label>
              <select
                id="method"
                value={form.methodName}
                onChange={(e) => setForm((f) => ({ ...f, methodName: e.target.value }))}
                required
                disabled={!selectedCountry}
                className="h-11 w-full border border-line bg-white px-3 text-sm outline-none transition-colors focus:border-ocean disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="" disabled>
                  {selectedCountry ? "Select a payment method" : "Select a country first"}
                </option>
                {groupedMethods.map((group) => (
                  <optgroup key={group.category} label={PAYMENT_METHOD_CATEGORY_LABELS[group.category]}>
                    {group.options.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          <div className="-mt-2 text-sm text-muted">
            Bank not in the list?{" "}
            {form.customBank ? (
              <button type="button" onClick={() => setForm((f) => ({ ...f, customBank: false, customBankName: "" }))} className="font-semibold text-ocean underline underline-offset-2">
                Cancel
              </button>
            ) : (
              <button type="button" onClick={() => setForm((f) => ({ ...f, customBank: true, methodName: "" }))} className="font-semibold text-ocean underline underline-offset-2">
                Add bank
              </button>
            )}
          </div>

          <div>
            <label htmlFor="accountHolderName" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Account holder name <span className="normal-case text-muted/70">(optional)</span>
            </label>
            <input
              id="accountHolderName"
              value={form.accountHolderName}
              onChange={(e) => setForm((f) => ({ ...f, accountHolderName: e.target.value }))}
              className="h-11 w-full border border-line bg-white px-3 text-sm outline-none transition-colors focus:border-ocean"
              placeholder="Name on the account"
            />
          </div>

          <div>
            <label htmlFor="accountIdentifier" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Account number / identifier
            </label>
            <input
              id="accountIdentifier"
              value={form.accountIdentifier}
              onChange={(e) => setForm((f) => ({ ...f, accountIdentifier: e.target.value }))}
              required
              className="h-11 w-full border border-line bg-white px-3 text-sm outline-none transition-colors focus:border-ocean"
              placeholder="Account number, phone number, or wallet address"
            />
          </div>

          <div>
            <label htmlFor="note" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Note <span className="normal-case text-muted/70">(optional)</span>
            </label>
            <input
              id="note"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className="h-11 w-full border border-line bg-white px-3 text-sm outline-none transition-colors focus:border-ocean"
              placeholder="Branch, or other details"
            />
          </div>

          {error && <p className="text-sm font-semibold text-coral">{error}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="flex h-10 items-center gap-2 bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Save changes" : "Add method"}
            </button>
            <button type="button" onClick={() => setFormOpen(false)} className="h-10 px-4 text-sm font-semibold text-muted transition-colors hover:text-ink">
              Cancel
            </button>
          </div>
        </form>
      )}

      {methods.length === 0 && !formOpen ? (
        <div className="border border-dashed border-line bg-panel p-8 text-center">
          <CreditCard className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-3 text-sm font-semibold">No payment methods yet</p>
          <p className="mt-1 text-sm text-muted">Add a payment method to start trading.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {methods.map((method) => {
            const details = method.details as { accountIdentifier?: string; note?: string; countryCode?: string };
            return (
              <li key={method.id} className="flex items-start justify-between gap-4 border border-line bg-white p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{method.method_name}</span>
                    {method.method_type && (
                      <span className="border border-line bg-panel px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                        {categoryDisplay(method.method_type)}
                      </span>
                    )}
                    {method.is_verified && (
                      <span className="border border-mint bg-mint/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-moss">
                        Verified
                      </span>
                    )}
                  </div>
                  {details.countryCode && <p className="mt-0.5 text-xs text-muted">{countryLabel(details.countryCode)}</p>}
                  {method.account_holder_name && <p className="mt-0.5 text-sm text-muted">{method.account_holder_name}</p>}
                  {details.accountIdentifier && <p className="truncate font-mono text-sm text-muted">{details.accountIdentifier}</p>}
                  {details.note && <p className="text-sm text-muted">{details.note}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => startEdit(method)} className="flex h-9 w-9 items-center justify-center border border-line text-muted transition-colors hover:bg-panel hover:text-ink" aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => void remove(method.id)} className="flex h-9 w-9 items-center justify-center border border-line text-muted transition-colors hover:bg-coral/10 hover:text-coral" aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
