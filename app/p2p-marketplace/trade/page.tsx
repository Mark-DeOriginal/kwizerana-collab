"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, ArrowRight, BadgeCheck, Check, ChevronDown, Clock, ImagePlus, Loader2, LogIn, RefreshCw, X } from "lucide-react";
import { readJson } from "@/lib/client-request";
import { compressImage } from "@/lib/p2p/compress-image";
import { CRYPTO_CURRENCIES, type Currency } from "@/lib/p2p/currencies-shared";
import { COUNTRIES, PAYMENT_METHOD_CATEGORY_LABELS, type Country } from "@/lib/p2p/countries-shared";
import type { UserPaymentMethod } from "@/lib/p2p/payment-methods-shared";
import type { Offer } from "@/lib/p2p/offers";
import type { Trade } from "@/lib/p2p/trades";

type Side = "buy" | "sell";

const TRADE_STATUS_LABELS: Record<string, string> = {
  created: "Awaiting payment",
  pending_payment: "Awaiting payment",
  payment_sent: "Payment sent",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
  disputed: "Disputed"
};

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

function OfferCard({ offer, side, activeTrade, onSelect, onResume }: { offer: Offer; side: Side; activeTrade?: Trade; onSelect: (offer: Offer) => void; onResume: (trade: Trade) => void }) {
  const tierLabel = offer.vendor.verifiedTier !== "none" ? offer.vendor.verifiedTier : offer.vendor.advertiserStatus !== "none" ? "advertiser" : null;

  return (
    <div className={`border p-4 transition-colors sm:p-5 ${activeTrade ? "border-ocean bg-mint/20" : "border-line bg-white hover:border-ocean"}`}>
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
            {activeTrade && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ocean/30 bg-ocean/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ocean">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ocean" />
                Trade in progress
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

        {activeTrade ? (
          <button
            onClick={() => onResume(activeTrade)}
            className="flex h-11 shrink-0 items-center gap-2 bg-ocean px-6 text-sm font-semibold text-white transition-colors hover:bg-ocean/90"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            Resume trade
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => onSelect(offer)}
            className="h-11 shrink-0 bg-ink px-6 text-sm font-semibold text-white transition-colors hover:bg-ocean"
          >
            {side === "buy" ? `Buy ${offer.crypto_currency}` : `Sell ${offer.crypto_currency}`}
          </button>
        )}
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
  onSelect,
  onRefresh,
  activeTradesByAd,
  onResume
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
  onRefresh: () => void;
  activeTradesByAd: Map<string, Trade>;
  onResume: (trade: Trade) => void;
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
        <button
          onClick={onRefresh}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink disabled:cursor-default"
          aria-label="Refresh vendors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          <span>{loading ? "Loading…" : `${offers.length} ${offers.length === 1 ? "vendor" : "vendors"}`}</span>
        </button>
      </div>

      {/* Vendor list */}
      <div className="space-y-3 p-4 sm:p-5">
        {loading ? (
          <div className="flex items-center gap-3 border border-line bg-white p-6 text-sm text-muted">
            <Loader2 className="h-5 w-5 animate-spin text-ocean" />
            Loading vendors…
          </div>
        ) : offers.length === 0 ? (
          <div className="border border-dashed border-line bg-panel p-10 text-center">
            <p className="font-semibold">No {side === "buy" ? "sellers" : "buyers"} for {asset}/{fiat} yet</p>
            <p className="mt-1 text-sm text-muted">Check back soon as more vendors join.</p>
          </div>
        ) : (
          offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              side={side}
              activeTrade={activeTradesByAd.get(offer.id)}
              onSelect={onSelect}
              onResume={onResume}
            />
          ))
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
  onMethodsChanged,
  onTradeCreated
}: {
  offer: Offer;
  side: Side;
  savedMethods: UserPaymentMethod[];
  onBack: () => void;
  onMethodsChanged: (methods: UserPaymentMethod[]) => void;
  onTradeCreated: (trade: Trade) => void;
}) {
  const [amount, setAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

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

  async function submitTrade() {
    setError("");
    setCreating(true);
    const cryptoAmount = isBuy ? (price ? payNum / price : 0) : payNum;
    const res = await fetch("/api/p2p/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adId: offer.id, cryptoAmount, paymentMethodId })
    });
    const data = await readJson<{ trade?: Trade; error?: string }>(res);
    setCreating(false);
    if (!res.ok || !data?.trade) {
      setError(data?.error ?? "Unable to create trade.");
      return;
    }
    onTradeCreated(data.trade);
  }

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Back to vendors
      </button>

      {/* Vendor summary */}
      <div className="flex items-start gap-3 border border-line bg-white p-4">
        <VendorAvatar name={offer.vendor.name} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{offer.vendor.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            <span className="font-semibold text-ink">1 {offer.crypto_currency} = {formatNumber(price)} {offer.fiat_currency}</span>
            <span className="mx-1.5">·</span>
            Limits: {formatNumber(offer.min_amount)} – {formatNumber(offer.max_amount)} {offer.fiat_currency}
          </p>
          <p className="mt-1 hidden text-xs text-muted sm:block">
            {offer.vendor.completionRate}% completion · {formatNumber(offer.vendor.totalTrades, 0)} trades
          </p>
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
        onAmountChange={setAmount}
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
        <span className="mb-2 block text-sm font-semibold">{isBuy ? "Pay with" : "Receive fiat via"}</span>
        {isBuy ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {offer.payment_methods.map((pm) => {
              const active = paymentMethodId === pm.id;
              return (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => setPaymentMethodId(pm.id)}
                  className={`flex h-11 items-center justify-between border px-3 text-sm font-semibold transition-colors ${
                    active ? "border-ocean bg-mint/60 text-ink" : "border-line bg-white text-muted hover:border-ocean hover:text-ink"
                  }`}
                >
                  {pm.method_name}
                  {active && <Check className="h-4 w-4 text-ocean" />}
                </button>
              );
            })}
            {offer.payment_methods.length === 0 && (
              <p className="text-sm text-muted sm:col-span-2">This vendor hasn&apos;t added receiving options yet.</p>
            )}
          </div>
        ) : !selectedCountry ? (
          <p className="text-sm text-muted">No payment methods available for {offer.fiat_currency}.</p>
        ) : (
          <>
            <div className="relative">
              <select
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
                className="h-11 w-full cursor-pointer appearance-none border border-line bg-white px-3 pr-8 text-sm outline-none focus:border-ocean"
              >
                <option value="" disabled>Select where you&apos;ll receive fiat</option>
                {savedForCountry.map((m) => (
                  <option key={m.id} value={m.id}>{m.method_name}</option>
                ))}
                <option value="new">＋ Add a new payment method</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            </div>
            {paymentMethodId === "new" && (
              <NewPaymentMethodForm
                country={selectedCountry}
                onSaved={(method) => {
                  onMethodsChanged([method, ...savedMethods]);
                  setPaymentMethodId(method.id);
                }}
              />
            )}
          </>
        )}
      </div>

      {/* Summary */}
      <div className="space-y-2.5 border border-line bg-panel p-4">
        <SummaryRow label="Rate" value={`1 ${offer.crypto_currency} = ${formatNumber(price)} ${offer.fiat_currency}`} />
        <SummaryRow label="You pay" value={`${formatNumber(payNum)} ${payCurrency}`} />
        <SummaryRow label="You receive" value={`${formatNumber(receiveNum, receiveDecimals)} ${receiveCurrency}`} />
        <SummaryRow label="Fee" value={`0.00 ${offer.crypto_currency}`} note="0% taker fee" />
      </div>

      {error && <p className="text-sm font-semibold text-coral">{error}</p>}
      <button
        disabled={!canConfirm || creating}
        onClick={() => void submitTrade()}
        className="flex h-12 w-full items-center justify-center gap-2 bg-ink text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:cursor-not-allowed disabled:opacity-50"
      >
        {creating && <Loader2 className="h-4 w-4 animate-spin" />}
        {side === "buy" ? `Buy ${offer.crypto_currency}` : `Sell ${offer.crypto_currency}`}
      </button>
    </div>
  );
}

function TradeDetail({ trade, onBack, onRefresh }: { trade: Trade; onBack: () => void; onRefresh: () => void }) {
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rating, setRating] = useState<string | null>(null);
  const [ratingError, setRatingError] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [disputeCountdown, setDisputeCountdown] = useState(0);

  const isBuyer = trade.my_role === "buyer";
  const isSeller = trade.my_role === "seller";
  const counterparty = isBuyer ? trade.seller_name : trade.buyer_name;
  const accountIdentifier = (trade.payment_details as { accountIdentifier?: string }).accountIdentifier;
  const isActive = trade.status === "created" || trade.status === "pending_payment" || trade.status === "payment_sent";

  // Countdown timer for dispute eligibility (1 hour after payment_sent)
  useEffect(() => {
    if (trade.status !== "payment_sent" || !trade.buyer_paid_at) {
      setDisputeCountdown(0);
      return;
    }
    const paidAt = new Date(trade.buyer_paid_at).getTime();
    const disputeAt = paidAt + 60 * 60 * 1000;
    function tick() {
      const remaining = Math.max(0, Math.ceil((disputeAt - Date.now()) / 1000));
      setDisputeCountdown(remaining);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [trade.status, trade.buyer_paid_at]);

  const disputeReady = trade.status === "payment_sent" && disputeCountdown === 0;

  function formatCountdown(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  async function doAction(action: string, imageBase64?: string) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/p2p/trades/${trade.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, receipt_image: imageBase64 })
    });
    const data = await readJson<{ error?: string }>(res);
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Unable to update trade.");
      return;
    }
    setShowReceipt(false);
    setReceiptPreview(null);
    setReceiptFile(null);
    onRefresh();
  }

  async function doDispute() {
    if (!disputeReason.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/p2p/trades/${trade.id}/dispute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: disputeReason.trim() })
    });
    const data = await readJson<{ error?: string }>(res);
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Unable to submit dispute.");
      return;
    }
    setShowDispute(false);
    setDisputeReason("");
    onRefresh();
  }

  async function doRate(r: string) {
    setBusy(true);
    setRatingError("");
    const res = await fetch(`/api/p2p/trades/${trade.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: r })
    });
    const data = await readJson<{ error?: string }>(res);
    setBusy(false);
    if (!res.ok) {
      setRatingError(data?.error ?? "Unable to submit review.");
      return;
    }
    setRating(r);
  }

  const statusTone =
    trade.status === "completed"
      ? "text-moss"
      : trade.status === "disputed"
        ? "text-coral"
        : trade.status === "cancelled" || trade.status === "expired"
          ? "text-muted"
          : "text-ocean";

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Back to vendors
      </button>

      {/* Trade header */}
      <div className="flex items-center justify-between gap-3 border border-line bg-white p-4">
        <div>
          <p className="text-xs text-muted">Trade {trade.trade_ref}</p>
          <p className="font-semibold">
            {isBuyer ? "Buying" : "Selling"} {formatNumber(trade.crypto_amount, 6)} {trade.crypto_currency} {isBuyer ? "from" : "to"} <span className="text-ocean">{counterparty}</span>
          </p>
        </div>
        <span className={`shrink-0 text-xs font-bold uppercase tracking-wide ${statusTone}`}>
          {TRADE_STATUS_LABELS[trade.status] ?? trade.status}
        </span>
      </div>

      {/* Summary */}
      <div className="space-y-2 border border-line bg-white p-4">
        <SummaryRow label="Rate" value={`1 ${trade.crypto_currency} = ${formatNumber(trade.price_at_trade)} ${trade.fiat_currency}`} />
        <SummaryRow label="Fiat amount" value={`${formatNumber(trade.fiat_amount)} ${trade.fiat_currency}`} />
        {trade.payment_reference && (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">Payment reference</span>
            <span className="font-mono font-semibold text-ink">{trade.payment_reference}</span>
          </div>
        )}
      </div>

      {/* Payment details */}
      <div className="border border-line bg-white p-4">
        <p className="text-sm font-semibold">{isBuyer ? "Send your fiat to" : "You'll receive fiat via"}</p>
        <div className="mt-2 space-y-1 text-sm text-muted">
          <p className="font-semibold text-ink">{trade.payment_method_name ?? "—"}</p>
          {trade.payment_account_holder && <p>Account holder: <span className="font-semibold text-ink">{trade.payment_account_holder}</span></p>}
          {accountIdentifier && <p>Account: <span className="font-mono font-semibold text-ink">{accountIdentifier}</span></p>}
          {trade.payment_reference && (
            <p>Include this reference in your payment: <span className="font-mono font-semibold text-ink">{trade.payment_reference}</span></p>
          )}
        </div>
      </div>

      {/* Buyer's receipt image (visible to seller) */}
      {isSeller && trade.receipt_image && (
        <div className="border border-line bg-panel p-4 text-sm">
          <p className="font-semibold">Buyer&apos;s payment receipt</p>
          <img
            src={trade.receipt_image}
            alt="Payment receipt"
            className="mt-2 max-h-80 border border-line object-contain"
          />
        </div>
      )}

      {/* Error */}
      {error && <p className="text-sm font-semibold text-coral">{error}</p>}

      {/* Completed */}
      {trade.status === "completed" && (
        <div className="flex items-start gap-2 border border-mint bg-mint/40 p-3 text-sm leading-6">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-moss" />
          <span>Trade completed. {isBuyer ? `You received ${formatNumber(trade.crypto_amount, 6)} ${trade.crypto_currency}.` : `You sent ${formatNumber(trade.crypto_amount, 6)} ${trade.crypto_currency}.`}</span>
        </div>
      )}

      {trade.status === "completed" && (
        <div className="border border-line bg-white p-4">
          <p className="text-sm font-semibold">Rate your counterparty</p>
          {rating ? (
            <p className="mt-2 text-sm font-semibold text-moss">Thanks for rating {counterparty}.</p>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {(["positive", "neutral", "negative"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => void doRate(r)}
                  disabled={busy}
                  className="h-9 border border-line bg-panel px-4 text-sm font-semibold capitalize text-muted transition-colors hover:border-ocean hover:text-ink disabled:opacity-60"
                >
                  {r}
                </button>
              ))}
            </div>
          )}
          {ratingError && <p className="mt-2 text-sm font-semibold text-coral">{ratingError}</p>}
        </div>
      )}

      {/* Cancelled */}
      {trade.status === "cancelled" && (
        <div className="border border-line bg-panel p-3 text-sm text-muted">This trade was cancelled.</div>
      )}

      {/* Expired */}
      {trade.status === "expired" && (
        <div className="border border-line bg-panel p-3 text-sm">
          <p className="font-semibold text-muted">Trade expired</p>
          <p className="mt-1 text-muted">This trade was not completed within the time window. No funds were released.</p>
        </div>
      )}

      {/* Disputed */}
      {trade.status === "disputed" && (
        <div className="border border-coral/40 bg-coral/10 p-3 text-sm leading-6">
          <p className="font-semibold">Trade disputed</p>
          <p className="text-muted">Support is reviewing this trade. You&apos;ll be notified of the outcome.</p>
        </div>
      )}

      {/* ── Active trade actions ─────────────────────────────────── */}
      {isActive && (
        <div className="space-y-3">
          {/* Buyer: receipt upload (created / pending_payment) */}
          {isBuyer && (trade.status === "created" || trade.status === "pending_payment") && (
            showReceipt ? (
              <div className="flex w-full flex-col gap-2">
                {receiptPreview ? (
                  <div className="relative border border-line bg-white p-2">
                    <img src={receiptPreview} alt="Receipt preview" className="max-h-48 object-contain" />
                    <button
                      onClick={() => { setReceiptPreview(null); setReceiptFile(null); }}
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center bg-ink text-white transition-colors hover:bg-coral"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-24 cursor-pointer items-center justify-center gap-2 border border-dashed border-line bg-white text-sm text-muted transition-colors hover:border-ocean hover:text-ink">
                    <ImagePlus className="h-4 w-4" />
                    Upload payment receipt
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setReceiptFile(file);
                        try {
                          const compressed = await compressImage(file);
                          setReceiptPreview(compressed);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Failed to process image.");
                          setReceiptFile(null);
                        }
                      }}
                    />
                  </label>
                )}
                <button
                  onClick={async () => {
                    if (!receiptPreview) return;
                    await doAction("mark_paid", receiptPreview);
                  }}
                  disabled={busy || !receiptPreview}
                  className="h-11 bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit receipt"}
                </button>
              </div>
            ) : (
              <button onClick={() => { setShowReceipt(true); setReceiptPreview(null); setReceiptFile(null); }} disabled={busy} className="h-11 bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-60">
                I&apos;ve sent the payment
              </button>
            )
          )}

          {/* Seller: release (payment_sent) */}
          {isSeller && trade.status === "payment_sent" && (
            <button onClick={() => void doAction("release")} disabled={busy} className="h-11 bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm &amp; release {trade.crypto_currency}
            </button>
          )}

          {/* Cancel (created / pending_payment) */}
          {(trade.status === "created" || trade.status === "pending_payment") && (
            <button onClick={() => void doAction("cancel")} disabled={busy} className="h-11 border border-line px-5 text-sm font-semibold text-muted transition-colors hover:border-coral hover:text-coral disabled:opacity-60">
              Cancel trade
            </button>
          )}

          {/* Dispute — payment_sent with countdown */}
          {trade.status === "payment_sent" && !showDispute && (
            disputeReady ? (
              <button onClick={() => setShowDispute(true)} className="h-11 border border-coral px-5 text-sm font-semibold text-coral transition-colors hover:bg-coral hover:text-white">
                Submit dispute
              </button>
            ) : (
              <button disabled className="flex h-11 items-center gap-2 border border-line bg-panel px-5 text-sm font-semibold text-muted">
                <Clock className="h-4 w-4" />
                Submit dispute in {formatCountdown(disputeCountdown)}
              </button>
            )
          )}

          {/* Dispute form */}
          {showDispute && (
            <div className="flex flex-col gap-2 border border-coral/40 bg-coral/5 p-3">
              <p className="text-sm font-semibold text-coral">Describe the issue</p>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="What went wrong? Include details like transaction proof..."
                rows={3}
                className="border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral"
              />
              <div className="flex items-center gap-2">
                <button onClick={() => void doDispute()} disabled={busy || !disputeReason.trim()} className="h-9 bg-coral px-4 text-sm font-semibold text-white transition-colors hover:bg-coral/80 disabled:opacity-60">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit dispute"}
                </button>
                <button onClick={() => { setShowDispute(false); setDisputeReason(""); }} disabled={busy} className="h-9 border border-line px-4 text-sm font-semibold text-muted transition-colors hover:text-ink disabled:opacity-60">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Help text — only for active, non-completed states */}
      {isActive && trade.status !== "payment_sent" && (
        <p className="text-xs text-muted">
          {isBuyer
            ? "Send the fiat amount to the account above, then submit your receipt. The seller will release the crypto once payment is confirmed."
            : "The buyer will send fiat to your account above. Release the crypto once you've confirmed the funds arrived."}
        </p>
      )}
      {trade.status === "payment_sent" && (
        <p className="text-xs text-muted">
          {isBuyer
            ? "Receipt submitted. The seller will review and release the crypto. You can submit a dispute after 1 hour if there is no response."
            : "The buyer has submitted their payment receipt. Review it above and release the crypto once you confirm the funds arrived."}
        </p>
      )}
    </div>
  );
}

function TradeClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status } = useSession();
  const tradeParam = searchParams.get("trade");

  const [side, setSide] = useState<Side>(searchParams.get("side") === "sell" ? "sell" : "buy");
  const [asset, setAsset] = useState("USDT");
  const [fiat, setFiat] = useState("USD");
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [savedMethods, setSavedMethods] = useState<UserPaymentMethod[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [activeTrade, setActiveTrade] = useState<Trade | null>(null);
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const offersCache = useRef<Map<string, Offer[]>>(new Map());

  const loadTrades = useCallback(async () => {
    const res = await fetch("/api/p2p/trades", { cache: "no-store" });
    const data = await readJson<{ trades: Trade[] }>(res);
    if (res.ok) setActiveTrades(data?.trades ?? []);
  }, []);

  useEffect(() => {
    if (status === "authenticated") void loadTrades();
  }, [status, loadTrades]);

  const activeTradesByAd = useMemo(() => {
    const map = new Map<string, Trade>();
    for (const t of activeTrades) {
      if (["created", "pending_payment", "payment_sent"].includes(t.status) && !map.has(t.ad_id)) {
        map.set(t.ad_id, t);
      }
    }
    return map;
  }, [activeTrades]);

  const refreshTrade = useCallback(async (tradeId: string) => {
    const res = await fetch(`/api/p2p/trades/${tradeId}`, { cache: "no-store" });
    const data = await readJson<{ trade?: Trade }>(res);
    if (res.ok && data?.trade) setActiveTrade(data.trade);
  }, []);

  useEffect(() => {
    if (!activeTrade || ["completed", "cancelled", "expired", "disputed"].includes(activeTrade.status)) return;
    const timer = setInterval(() => void refreshTrade(activeTrade.id), 10000);
    return () => clearInterval(timer);
  }, [activeTrade, refreshTrade]);

  // Restore an in-progress trade after a refresh (e.g. /trade?trade=123).
  useEffect(() => {
    if (status !== "authenticated" || !tradeParam) return;
    fetch(`/api/p2p/trades/${tradeParam}`, { cache: "no-store" })
      .then((res) => readJson<{ trade?: Trade }>(res))
      .then((data) => {
        if (data?.trade) {
          setActiveTrade(data.trade);
          setSide(data.trade.my_role === "buyer" ? "buy" : "sell");
        }
      })
      .catch(() => {});
  }, [status, tradeParam]);

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

  const loadOffers = useCallback(
    async (force = false) => {
      const key = `${side}:${asset}:${fiat}`;
      if (!force) {
        const cached = offersCache.current.get(key);
        if (cached) {
          setOffers(cached);
          setOffersLoading(false);
          return;
        }
      }
      setOffersLoading(true);
      try {
        const res = await fetch(`/api/p2p/offers?side=${side}&asset=${asset}&fiat=${fiat}`, { cache: "no-store" });
        const data = await readJson<{ offers: Offer[] }>(res);
        const list = data?.offers ?? [];
        offersCache.current.set(key, list);
        setOffers(list);
      } finally {
        setOffersLoading(false);
      }
    },
    [side, asset, fiat]
  );

  useEffect(() => {
    if (status === "authenticated") void loadOffers();
  }, [status, loadOffers]);

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
              {activeTrade
                ? `${activeTrade.my_role === "buyer" ? "Buying" : "Selling"} ${activeTrade.crypto_currency}`
                : selectedOffer
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
            style={{ transform: selectedOffer || activeTrade ? "translateX(-100%)" : "translateX(0)" }}
          >
            {/* Stage 1 */}
            <div className="w-full shrink-0">
              <OfferList
                side={side}
                onSideChange={(s) => {
                  setSide(s);
                  setSelectedOffer(null);
                  setActiveTrade(null);
                  router.replace(`/p2p-marketplace/trade?side=${s}`, { scroll: false });
                }}
                asset={asset}
                onAssetChange={setAsset}
                fiat={fiat}
                fiatOptions={fiatOptions}
                onFiatChange={setFiat}
                offers={offers}
                loading={offersLoading}
                onSelect={(offer) => { setActiveTrade(null); setSelectedOffer(offer); }}
                onRefresh={() => void loadOffers(true)}
                activeTradesByAd={activeTradesByAd}
                onResume={(trade) => {
                  setActiveTrade(trade);
                  setSelectedOffer(null);
                  router.replace(`/p2p-marketplace/trade?side=${side}&trade=${trade.id}`, { scroll: false });
                }}
              />
            </div>

            {/* Stage 2 */}
            <div className="w-full shrink-0">
              {activeTrade ? (
                <TradeDetail
                  trade={activeTrade}
                  onBack={() => {
                    setActiveTrade(null);
                    setSelectedOffer(null);
                    router.replace(`/p2p-marketplace/trade?side=${side}`, { scroll: false });
                    void loadTrades();
                  }}
                  onRefresh={() => {
                    void refreshTrade(activeTrade.id);
                    void loadTrades();
                  }}
                />
              ) : selectedOffer ? (
                <OrderForm
                  offer={selectedOffer}
                  side={side}
                  savedMethods={savedMethods}
                  onBack={() => setSelectedOffer(null)}
                  onMethodsChanged={setSavedMethods}
                  onTradeCreated={(trade) => {
                    setActiveTrade(trade);
                    router.replace(`/p2p-marketplace/trade?side=${side}&trade=${trade.id}`, { scroll: false });
                    void loadTrades();
                  }}
                />
              ) : null}
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
