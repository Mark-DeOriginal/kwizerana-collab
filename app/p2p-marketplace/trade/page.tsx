"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, BadgeCheck, Check, ChevronDown, Loader2, LogIn } from "lucide-react";
import { readJson } from "@/lib/client-request";
import { CRYPTO_CURRENCIES, type Currency } from "@/lib/p2p/currencies-shared";
import { COUNTRIES, PAYMENT_METHOD_CATEGORY_LABELS, type Country } from "@/lib/p2p/countries-shared";
import type { UserPaymentMethod } from "@/lib/p2p/payment-methods-shared";
import type { Offer } from "@/lib/p2p/offers";

type Side = "buy" | "sell";

const categoryOrder = ["bank", "mobile_money", "digital_wallet"] as const;

function formatNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) value = 0;
  return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

function sanitizeAmount(value: string): string {
  let s = value.replace(/[^\d.]/g, "");
  const parts = s.split(".");
  if (parts.length > 2) s = `${parts[0]}.${parts.slice(1).join("")}`;
  return s;
}

function VendorAvatar({ name }: { name: string }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ocean text-sm font-bold text-white">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function CurrencyInput({
  label,
  amount,
  onAmountChange,
  readOnly = false,
  currency
}: {
  label: string;
  amount: string;
  onAmountChange?: (value: string) => void;
  readOnly?: boolean;
  currency: string;
}) {
  return (
    <div className="border border-line bg-white transition-colors focus-within:border-ocean focus-within:ring-1 focus-within:ring-ocean/30">
      <div className="flex items-stretch">
        <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            readOnly={readOnly}
            onChange={(e) => onAmountChange?.(sanitizeAmount(e.target.value))}
            placeholder="0.00"
            className={`w-full bg-transparent text-xl font-semibold text-ink outline-none placeholder:text-muted/60 ${
              readOnly ? "text-ocean" : ""
            }`}
          />
        </div>
        <div className="flex w-20 shrink-0 items-center justify-center border-l border-line">
          <span className="text-sm font-semibold text-muted">{currency}</span>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-1.5 text-right">
        <span className="font-semibold text-ink">{value}</span>
        {note && <span className="text-xs text-muted">{note}</span>}
      </span>
    </div>
  );
}

function NewPaymentMethodForm({ country, onSaved }: { country: Country; onSaved: (method: UserPaymentMethod) => void }) {
  const [customBank, setCustomBank] = useState(false);
  const [methodName, setMethodName] = useState("");
  const [customBankName, setCustomBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const grouped = categoryOrder
    .map((category) => ({ category, options: country.methods.filter((m) => m.category === category) }))
    .filter((group) => group.options.length > 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);

    let methodType: string;
    let finalName: string;
    if (customBank) {
      methodType = "bank";
      finalName = customBankName.trim();
    } else {
      const option = country.methods.find((m) => m.name === methodName);
      methodType = option?.category ?? "";
      finalName = methodName;
    }

    const res = await fetch("/api/p2p/payment-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method_type: methodType,
        method_name: finalName,
        account_holder_name: accountHolder,
        details: { accountIdentifier: accountNumber, countryCode: country.code, countryName: country.name }
      })
    });
    const data = await readJson<{ method?: UserPaymentMethod; error?: string }>(res);
    setBusy(false);

    if (!res.ok || !data?.method) {
      setError(data?.error ?? "Unable to save payment method.");
      return;
    }

    onSaved(data.method);
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 border border-line bg-panel p-4">
      {customBank ? (
        <div>
          <label htmlFor="pm-custom-bank" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Bank name</label>
          <input
            id="pm-custom-bank"
            value={customBankName}
            onChange={(e) => setCustomBankName(e.target.value)}
            required
            className="h-10 w-full border border-line bg-white px-3 text-sm outline-none focus:border-ocean"
            placeholder="Enter your bank's name"
          />
        </div>
      ) : (
        <div>
          <label htmlFor="pm-method" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Method</label>
          <select
            id="pm-method"
            value={methodName}
            onChange={(e) => setMethodName(e.target.value)}
            required
            className="h-10 w-full border border-line bg-white px-3 text-sm outline-none focus:border-ocean"
          >
            <option value="" disabled>Select a method</option>
            {grouped.map((group) => (
              <optgroup key={group.category} label={PAYMENT_METHOD_CATEGORY_LABELS[group.category]}>
                {group.options.map((m) => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}

      <div className="text-sm text-muted">
        Bank not in the list?{" "}
        {customBank ? (
          <button type="button" onClick={() => { setCustomBank(false); setCustomBankName(""); }} className="font-semibold text-ocean underline underline-offset-2">Cancel</button>
        ) : (
          <button type="button" onClick={() => { setCustomBank(true); setMethodName(""); }} className="font-semibold text-ocean underline underline-offset-2">Add bank</button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="pm-holder" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Account holder</label>
          <input
            id="pm-holder"
            value={accountHolder}
            onChange={(e) => setAccountHolder(e.target.value)}
            className="h-10 w-full border border-line bg-white px-3 text-sm outline-none focus:border-ocean"
            placeholder="Name on account"
          />
        </div>
        <div>
          <label htmlFor="pm-number" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Account number</label>
          <input
            id="pm-number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            required
            className="h-10 w-full border border-line bg-white px-3 text-sm outline-none focus:border-ocean"
            placeholder="Account / phone number"
          />
        </div>
      </div>

      {error && <p className="text-sm font-semibold text-coral">{error}</p>}

      <button type="submit" disabled={busy} className="flex h-10 items-center gap-2 bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-60">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Save & use
      </button>
    </form>
  );
}

function OfferCard({ offer, side, onSelect }: { offer: Offer; side: Side; onSelect: (offer: Offer) => void }) {
  const tierLabel = offer.vendor.verifiedTier !== "none" ? offer.vendor.verifiedTier : offer.vendor.advertiserStatus !== "none" ? "advertiser" : null;

  return (
    <div className="border border-line bg-white p-4 transition-colors hover:border-ocean sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <VendorAvatar name={offer.vendor.name} />
            <span className="truncate font-semibold">{offer.vendor.name}</span>
            {tierLabel && (
              <span className="inline-flex items-center gap-1 border border-mint bg-mint/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-moss">
                <BadgeCheck className="h-3 w-3" />
                {tierLabel}
              </span>
            )}
            <span className="text-xs text-muted">
              {offer.vendor.completionRate}% · {formatNumber(offer.vendor.totalTrades, 0)} trades
            </span>
          </div>

          <p className="mt-3 text-xl font-bold text-ink">
            <span className="text-base font-semibold text-muted">1 {offer.crypto_currency} =</span>{" "}
            {formatNumber(offer.price_value)} {offer.fiat_currency}
          </p>

          <p className="mt-1 text-sm text-muted">
            Limits: {formatNumber(offer.min_amount)} – {formatNumber(offer.max_amount)} {offer.fiat_currency}
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {offer.payment_methods.map((pm) => (
              <span key={pm.id} className="border border-line bg-panel px-2 py-1 text-xs font-semibold text-ink">
                {pm.method_name}
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={() => onSelect(offer)}
          className="h-11 shrink-0 bg-ink px-6 text-sm font-semibold text-white transition-colors hover:bg-ocean"
        >
          {side === "buy" ? `Buy ${offer.crypto_currency}` : `Sell ${offer.crypto_currency}`}
        </button>
      </div>
    </div>
  );
}

function OfferList({
  side,
  onSideChange,
  asset,
  onAssetChange,
  fiat,
  fiatOptions,
  onFiatChange,
  offers,
  loading,
  onSelect
}: {
  side: Side;
  onSideChange: (side: Side) => void;
  asset: string;
  onAssetChange: (asset: string) => void;
  fiat: string;
  fiatOptions: { code: string }[];
  onFiatChange: (fiat: string) => void;
  offers: Offer[];
  loading: boolean;
  onSelect: (offer: Offer) => void;
}) {
  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-line">
        <button
          onClick={() => onSideChange("buy")}
          className={`flex h-12 flex-1 items-center justify-center text-sm font-semibold transition-colors ${side === "buy" ? "border-b-2 border-ocean bg-panel text-ink" : "text-muted hover:text-ink"}`}
        >
          Buy
        </button>
        <button
          onClick={() => onSideChange("sell")}
          className={`flex h-12 flex-1 items-center justify-center text-sm font-semibold transition-colors ${side === "sell" ? "border-b-2 border-ocean bg-panel text-ink" : "text-muted hover:text-ink"}`}
        >
          Sell
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex items-center gap-1">
          {CRYPTO_CURRENCIES.map((code) => (
            <button
              key={code}
              onClick={() => onAssetChange(code)}
              className={`h-9 px-3 text-sm font-semibold transition-colors ${asset === code ? "bg-ink text-white" : "border border-line text-muted hover:border-ocean hover:text-ink"}`}
            >
              {code}
            </button>
          ))}
        </div>
        <div className="relative">
          <select
            value={fiat}
            onChange={(e) => onFiatChange(e.target.value)}
            className="h-9 cursor-pointer appearance-none border border-line bg-white pl-3 pr-8 text-sm font-semibold text-ink outline-none focus:border-ocean"
          >
            {fiatOptions.length === 0 ? <option value={fiat}>{fiat}</option> : fiatOptions.map((o) => <option key={o.code} value={o.code}>{o.code}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        </div>
        <span className="ml-auto text-sm text-muted">
          {loading ? "Loading offers…" : `${offers.length} ${offers.length === 1 ? "offer" : "offers"}`}
        </span>
      </div>

      {/* Offer list */}
      <div className="space-y-3 p-4 sm:p-5">
        {loading ? (
          <div className="flex items-center gap-3 border border-line bg-white p-6 text-sm text-muted">
            <Loader2 className="h-5 w-5 animate-spin text-ocean" />
            Loading offers…
          </div>
        ) : offers.length === 0 ? (
          <div className="border border-dashed border-line bg-panel p-10 text-center">
            <p className="font-semibold">No {side === "buy" ? "sellers" : "buyers"} for {asset}/{fiat} yet</p>
            <p className="mt-1 text-sm text-muted">Check back soon as more vendors join.</p>
          </div>
        ) : (
          offers.map((offer) => <OfferCard key={offer.id} offer={offer} side={side} onSelect={onSelect} />)
        )}
      </div>
    </div>
  );
}

function OrderForm({
  offer,
  side,
  savedMethods,
  onBack,
  onMethodsChanged
}: {
  offer: Offer;
  side: Side;
  savedMethods: UserPaymentMethod[];
  onBack: () => void;
  onMethodsChanged: (methods: UserPaymentMethod[]) => void;
}) {
  const [amount, setAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const countriesForFiat = useMemo(() => COUNTRIES.filter((c) => c.currency === offer.fiat_currency), [offer.fiat_currency]);
  const selectedCountry = countriesForFiat[0] ?? null;

  const savedForCountry = useMemo(
    () => savedMethods.filter((m) => (m.details as { countryCode?: string }).countryCode === selectedCountry?.code),
    [savedMethods, selectedCountry]
  );

  const isBuy = offer.ad_type === "sell";
  const price = offer.price_value;
  const payNum = Number.parseFloat(amount) || 0;
  const receiveNum = price ? (isBuy ? payNum / price : payNum * price) : 0;
  const payCurrency = isBuy ? offer.fiat_currency : offer.crypto_currency;
  const receiveCurrency = isBuy ? offer.crypto_currency : offer.fiat_currency;
  const receiveDecimals = isBuy ? 6 : 2;

  const canConfirm = payNum > 0 && paymentMethodId !== "" && paymentMethodId !== "new";

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Back to offers
      </button>

      {/* Vendor summary */}
      <div className="flex items-start justify-between gap-4 border border-line bg-white p-4">
        <div className="flex items-center gap-3">
          <VendorAvatar name={offer.vendor.name} />
          <div>
            <p className="font-semibold">{offer.vendor.name}</p>
            <p className="text-xs text-muted">
              {offer.vendor.completionRate}% completion · {formatNumber(offer.vendor.totalTrades, 0)} trades
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">1 {offer.crypto_currency} = {formatNumber(price)} {offer.fiat_currency}</p>
          <p className="text-xs text-muted">Limits: {formatNumber(offer.min_amount)} – {formatNumber(offer.max_amount)} {offer.fiat_currency}</p>
        </div>
      </div>

      {/* Vendor accepts */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Accepts:</span>
        {offer.payment_methods.map((pm) => (
          <span key={pm.id} className="border border-line bg-white px-2 py-1 text-xs font-semibold text-ink">
            {pm.method_name}
          </span>
        ))}
      </div>

      {/* Amounts */}
      <CurrencyInput
        label="You pay"
        amount={amount}
        onAmountChange={(v) => { setAmount(v); setConfirmed(false); }}
        currency={payCurrency}
      />
      <CurrencyInput
        label="You receive"
        amount={payNum > 0 ? formatNumber(receiveNum, receiveDecimals) : ""}
        readOnly
        currency={receiveCurrency}
      />

      {/* Payment method */}
      <div>
        <span className="mb-2 block text-sm font-semibold">Payment method</span>
        {!selectedCountry ? (
          <p className="text-sm text-muted">No payment methods available for {offer.fiat_currency}.</p>
        ) : (
          <div className="relative">
            <select
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              className="h-11 w-full cursor-pointer appearance-none border border-line bg-white px-3 pr-8 text-sm outline-none focus:border-ocean"
            >
              <option value="" disabled>Select a payment method</option>
              {savedForCountry.map((m) => (
                <option key={m.id} value={m.id}>{m.method_name}</option>
              ))}
              <option value="new">＋ Add a new payment method</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          </div>
        )}

        {selectedCountry && paymentMethodId === "new" && (
          <NewPaymentMethodForm
            country={selectedCountry}
            onSaved={(method) => {
              onMethodsChanged([method, ...savedMethods]);
              setPaymentMethodId(method.id);
            }}
          />
        )}
      </div>

      {/* Summary */}
      <div className="space-y-2.5 border border-line bg-panel p-4">
        <SummaryRow label="Rate" value={`1 ${offer.crypto_currency} = ${formatNumber(price)} ${offer.fiat_currency}`} />
        <SummaryRow label="You pay" value={`${formatNumber(payNum)} ${payCurrency}`} />
        <SummaryRow label="You receive" value={`${formatNumber(receiveNum, receiveDecimals)} ${receiveCurrency}`} />
        <SummaryRow label="Fee" value={`0.00 ${offer.crypto_currency}`} note="0% taker fee" />
      </div>

      {confirmed ? (
        <div className="flex items-start gap-2 border border-mint bg-mint/40 p-3 text-sm leading-6">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-moss" />
          <span>Order placed with {offer.vendor.name}. We&apos;ll guide you through payment and escrow when trading goes live.</span>
        </div>
      ) : (
        <button
          disabled={!canConfirm}
          onClick={() => setConfirmed(true)}
          className="flex h-12 w-full items-center justify-center gap-2 bg-ink text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:cursor-not-allowed disabled:opacity-50"
        >
          {side === "buy" ? `Buy ${offer.crypto_currency}` : `Sell ${offer.crypto_currency}`}
        </button>
      )}
    </div>
  );
}

function TradeClient() {
  const searchParams = useSearchParams();
  const { status } = useSession();

  const [side, setSide] = useState<Side>(searchParams.get("side") === "sell" ? "sell" : "buy");
  const [asset, setAsset] = useState("USDT");
  const [fiat, setFiat] = useState("USD");
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [savedMethods, setSavedMethods] = useState<UserPaymentMethod[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    Promise.all([fetch("/api/p2p/currencies", { cache: "no-store" }), fetch("/api/p2p/payment-methods", { cache: "no-store" })])
      .then(([cRes, pRes]) =>
        Promise.all([readJson<{ currencies: Currency[] }>(cRes), readJson<{ methods: UserPaymentMethod[] }>(pRes)])
      )
      .then(([cData, pData]) => {
        setCurrencies(cData?.currencies ?? []);
        setSavedMethods(pData?.methods ?? []);
      });
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    setOffersLoading(true);
    fetch(`/api/p2p/offers?side=${side}&asset=${asset}&fiat=${fiat}`, { cache: "no-store" })
      .then((res) => readJson<{ offers: Offer[] }>(res))
      .then((data) => setOffers(data?.offers ?? []))
      .finally(() => setOffersLoading(false));
  }, [side, asset, fiat, status]);

  const fiatOptions = useMemo(() => currencies.filter((c) => c.is_fiat).map((c) => ({ code: c.code })), [currencies]);

  if (status === "unauthenticated") {
    return (
      <div className="px-4 py-24 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md border border-line bg-white p-8 text-center shadow-tight">
          <LogIn className="mx-auto h-8 w-8 text-ocean" />
          <h1 className="mt-4 text-xl font-bold">Sign in to {side === "buy" ? "buy" : "sell"} crypto</h1>
          <p className="mt-2 text-sm text-muted">Create a free account to start trading USDT and USDC peer to peer.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href="/auth/sign-in" className="flex h-10 items-center gap-2 bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-ocean">Sign in</Link>
            <Link href="/auth/sign-up" className="flex h-10 items-center gap-2 border border-line px-5 text-sm font-semibold transition-colors hover:bg-panel">Create account</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">P2P Marketplace</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">
              {selectedOffer
                ? `${side === "buy" ? "Buy" : "Sell"} ${selectedOffer.crypto_currency}`
                : `${side === "buy" ? "Buy" : "Sell"} crypto`}
            </h1>
          </div>
          <Link href="/p2p-marketplace" className="text-sm font-semibold text-ocean hover:underline">
            Back
          </Link>
        </div>

        <div className="mt-5 overflow-hidden border border-line bg-white">
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: selectedOffer ? "translateX(-100%)" : "translateX(0)" }}
          >
            {/* Stage 1 */}
            <div className="w-full shrink-0">
              <OfferList
                side={side}
                onSideChange={(s) => { setSide(s); setSelectedOffer(null); }}
                asset={asset}
                onAssetChange={setAsset}
                fiat={fiat}
                fiatOptions={fiatOptions}
                onFiatChange={setFiat}
                offers={offers}
                loading={offersLoading}
                onSelect={(offer) => setSelectedOffer(offer)}
              />
            </div>

            {/* Stage 2 */}
            <div className="w-full shrink-0">
              {selectedOffer && (
                <OrderForm
                  offer={selectedOffer}
                  side={side}
                  savedMethods={savedMethods}
                  onBack={() => setSelectedOffer(null)}
                  onMethodsChanged={setSavedMethods}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense fallback={null}>
      <TradeClient />
    </Suspense>
  );
}
