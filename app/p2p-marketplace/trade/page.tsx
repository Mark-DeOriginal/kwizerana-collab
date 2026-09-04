"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, ArrowRight, BadgeCheck, Ban, Check, Clock, ImagePlus, Loader2, LogIn, Pin, Star, X } from "lucide-react";
import { readJson } from "@/lib/client-request";
import { CustomSelect, OptionsMenu } from "@/components/p2p/custom-ui";
import { formatThousandsInput } from "@/lib/p2p/number-format";
import { compressImage } from "@/lib/p2p/compress-image";
import { CRYPTO_CURRENCIES, type Currency } from "@/lib/p2p/currencies-shared";
import { COUNTRIES, PAYMENT_METHOD_CATEGORY_LABELS, type Country } from "@/lib/p2p/countries-shared";
import type { UserPaymentMethod } from "@/lib/p2p/payment-methods-shared";
import type { Offer } from "@/lib/p2p/offers";
import type { Trade } from "@/lib/p2p/trades";
import { usePoll, useTradeSubscription, isTerminalTrade } from "@/lib/p2p/use-realtime";
import { OrderDetailView } from "@/components/p2p/order-detail-view";

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
            value={readOnly ? amount : formatThousandsInput(amount)}
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
    if (!customBank && !methodName) {
      setError("Select a payment method.");
      return;
    }
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
          <CustomSelect
            value={methodName}
            onChange={setMethodName}
            groups={grouped.map((group) => ({
              label: PAYMENT_METHOD_CATEGORY_LABELS[group.category],
              options: group.options.map((m) => ({ value: m.name, label: m.name }))
            }))}
            placeholder="Select a method"
            triggerClassName="h-10"
          />
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

function OfferCard({ offer, side, activeTrade, onSelect, onResume, isFavorite, isPinned, onToggleFavorite, onTogglePin, onToggleBlock, myUserId }: { offer: Offer; side: Side; activeTrade?: Trade; onSelect: (offer: Offer) => void; onResume: (trade: Trade) => void; isFavorite: boolean; isPinned: boolean; onToggleFavorite: () => void; onTogglePin: () => void; onToggleBlock: () => void; myUserId?: string }) {
  const tierLabel = offer.vendor.verifiedTier !== "none" ? offer.vendor.verifiedTier : offer.vendor.advertiserStatus !== "none" ? "advertiser" : null;

  return (
    <div className={`border p-4 transition-colors sm:p-5 ${activeTrade ? "border-ocean bg-mint/20" : "border-line bg-white hover:border-ocean"}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <VendorAvatar name={offer.vendor.name} />
            <Link href={`/p2p-marketplace/vendor/${offer.vendor.id}`} className="truncate font-semibold hover:text-ocean hover:underline">{offer.vendor.name}</Link>
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
            <span className="ml-auto flex items-center gap-1">
              <OptionsMenu
                items={[
                  {
                    key: "favorite",
                    label: isFavorite ? "Unfavorite" : "Favorite",
                    icon: <Star className={`h-4 w-4 ${isFavorite ? "fill-current text-ocean" : ""}`} />,
                    active: isFavorite,
                    onClick: onToggleFavorite
                  },
                  {
                    key: "pin",
                    label: isPinned ? "Unpin" : "Pin to top",
                    icon: <Pin className={`h-4 w-4 ${isPinned ? "fill-current text-ocean" : ""}`} />,
                    active: isPinned,
                    onClick: onTogglePin
                  },
                  { key: "divider", divider: true },
                  {
                    key: "block",
                    label: "Block vendor",
                    icon: <Ban className="h-4 w-4" />,
                    danger: true,
                    onClick: onToggleBlock
                  }
                ]}
              />
            </span>
          </div>

          <p className="mt-3 text-xl font-bold text-ink">
            <span className="text-base font-semibold text-muted">1 {offer.crypto_currency} =</span>{" "}
            {formatNumber(offer.price_value)} {offer.fiat_currency}
          </p>

          {side === "buy" && offer.vendor.balance > 0 && (
            <p className="mt-1 text-xs font-semibold text-moss">
              {offer.vendor.balance <= offer.vendor.limitMin
                ? `Limit: ${formatNumber(offer.vendor.balance)} ${offer.crypto_currency}`
                : `Limit: ${formatNumber(offer.vendor.limitMin)} - ${formatNumber(offer.vendor.balance)} ${offer.crypto_currency}`}
            </p>
          )}

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
        ) : myUserId && myUserId === offer.vendor.id ? (
          <span className="flex h-11 shrink-0 items-center gap-2 border border-line bg-panel px-6 text-sm font-semibold text-muted">
            You
          </span>
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
  activeTradesByAd,
  onResume,
  favorites,
  pinned,
  blocked,
  favoritesOnly,
  onFavoritesOnlyChange,
  onToggleFavorite,
  onTogglePin,
  onToggleBlock,
  myUserId
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
  activeTradesByAd: Map<string, Trade>;
  onResume: (trade: Trade) => void;
  favorites: string[];
  pinned: string[];
  blocked: string[];
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (v: boolean) => void;
  onToggleFavorite: (vendorId: string) => void;
  onTogglePin: (vendorId: string) => void;
  onToggleBlock: (vendorId: string) => void;
  myUserId?: string;
}) {
  const visible = offers
    .filter((o) => !blocked.includes(o.vendor.id) && (!favoritesOnly || favorites.includes(o.vendor.id)))
    .sort((a, b) => Number(pinned.includes(b.vendor.id)) - Number(pinned.includes(a.vendor.id)));

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
        <CustomSelect
            value={fiat}
            onChange={onFiatChange}
            groups={[
              {
                options:
                  fiatOptions.length === 0
                    ? [{ value: fiat, label: fiat }]
                    : fiatOptions.map((o) => ({ value: o.code, label: o.code }))
              }
            ]}
            wrapperClassName="w-24"
            align="right"
            triggerClassName="h-9"
          />
        <button
          onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
          className={`flex h-9 items-center gap-1.5 px-3 text-sm font-semibold transition-colors ${favoritesOnly ? "bg-ink text-white" : "border border-line text-muted hover:border-ocean hover:text-ink"}`}
        >
          <Star className={`h-4 w-4 ${favoritesOnly ? "fill-current" : ""}`} />
          Favorites
        </button>
      </div>

      {/* Vendor list */}
      <div className="space-y-3 p-4 sm:p-5">
        {loading ? (
          <div className="flex items-center gap-3 border border-line bg-white p-6 text-sm text-muted">
            <Loader2 className="h-5 w-5 animate-spin text-ocean" />
            Loading vendors…
          </div>
        ) : visible.length === 0 ? (
          <div className="border border-dashed border-line bg-panel p-10 text-center">
            <p className="font-semibold">No {side === "buy" ? "sellers" : "buyers"} for {asset}/{fiat} yet</p>
            <p className="mt-1 text-sm text-muted">Check back soon as more vendors join.</p>
          </div>
        ) : (
          visible.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              side={side}
              activeTrade={activeTradesByAd.get(offer.id)}
              onSelect={onSelect}
              onResume={onResume}
              isFavorite={favorites.includes(offer.vendor.id)}
              isPinned={pinned.includes(offer.vendor.id)}
              onToggleFavorite={() => onToggleFavorite(offer.vendor.id)}
              onTogglePin={() => onTogglePin(offer.vendor.id)}
              onToggleBlock={() => onToggleBlock(offer.vendor.id)}
              myUserId={myUserId}
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
            <CustomSelect
                value={paymentMethodId}
                onChange={setPaymentMethodId}
                groups={[
                  {
                    options: savedForCountry.map((m) => ({ value: m.id, label: m.method_name }))
                  },
                  {
                    label: "New",
                    options: [{ value: "new", label: "＋ Add a new payment method" }]
                  }
                ]}
                placeholder="Select where you'll receive fiat"
                triggerClassName="h-11"
              />
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
        <SummaryRow
          label="Fee"
          value={`${formatNumber(receiveNum * (offer.takerFeeRate / 100), receiveDecimals)} ${receiveCurrency}`}
          note={`${offer.takerFeeRate}% taker fee`}
        />
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
  return (
    <div className="space-y-4 p-4 sm:p-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Back to vendors
      </button>
      <OrderDetailView trade={trade} onRefresh={onRefresh} />
    </div>
  );
}

function TradeClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const myUserId = session?.user?.id as string | undefined;
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
  const [favorites, setFavorites] = useState<string[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const offersStampRef = useRef("");

  const loadTrades = useCallback(async () => {
    const res = await fetch("/api/p2p/trades", { cache: "no-store" });
    const data = await readJson<{ trades: Trade[] }>(res);
    if (!res.ok) return;
    const list = data?.trades ?? [];
    const stamp = list.map((t) => `${t.id}:${t.status}:${t.escrow_status ?? ""}:${t.buyer_paid_at ?? ""}:${t.created_at}`).join("|");
    if (stamp === tradesStampRef.current) return;
    tradesStampRef.current = stamp;
    setActiveTrades(list);
  }, []);

  const tradesStampRef = useRef("");

  useEffect(() => {
    if (status === "authenticated") void loadTrades();
  }, [status, loadTrades]);

  // Silent list refresh while visible — new/dropped trades appear without interaction.
  usePoll(() => void loadTrades(), { intervalMs: 15000, enabled: status === "authenticated" });

  const activeTradesByAd = useMemo(() => {
    const map = new Map<string, Trade>();
    for (const t of activeTrades) {
      if (["created", "pending_payment", "payment_sent"].includes(t.status) && !map.has(t.ad_id)) {
        map.set(t.ad_id, t);
      }
    }
    return map;
  }, [activeTrades]);

  useTradeSubscription(activeTrade?.id, (t) => setActiveTrade(t), {
    enabled: Boolean(activeTrade) && !isTerminalTrade(activeTrade?.status ?? "")
  });

  // Instant refresh after an explicit action in the order modal (polling handles the rest).
  const refetchActiveTrade = useCallback(async (tradeId: string) => {
    const res = await fetch(`/api/p2p/trades/${tradeId}`, { cache: "no-store" });
    const data = await readJson<{ trade?: Trade }>(res);
    if (res.ok && data?.trade) setActiveTrade(data.trade);
  }, []);

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
      })
      .catch(() => {});
  }, [status]);

  const loadSocial = useCallback(async () => {
    const res = await fetch("/api/p2p/social", { cache: "no-store" });
    const data = await readJson<{ favorites?: string[]; blocked?: string[]; pinned?: string[] }>(res);
    if (res.ok && data) {
      setFavorites(data.favorites ?? []);
      setBlocked(data.blocked ?? []);
      setPinned(data.pinned ?? []);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") void loadSocial();
  }, [status, loadSocial]);

  async function toggleFavorite(vendorId: string) {
    setFavorites((prev) => (prev.includes(vendorId) ? prev.filter((v) => v !== vendorId) : [...prev, vendorId]));
    await fetch("/api/p2p/social?action=favorite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorId })
    }).catch(() => {});
  }

  async function togglePin(vendorId: string) {
    setPinned((prev) => (prev.includes(vendorId) ? prev.filter((v) => v !== vendorId) : [...prev, vendorId]));
    await fetch("/api/p2p/social?action=pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorId })
    }).catch(() => {});
  }

  async function toggleBlock(vendorId: string) {
    setBlocked((prev) => (prev.includes(vendorId) ? prev.filter((v) => v !== vendorId) : [...prev, vendorId]));
    await fetch("/api/p2p/social?action=block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorId })
    }).catch(() => {});
  }

  const loadOffers = useCallback(async () => {
    setOffersLoading(true);
    try {
      const res = await fetch(`/api/p2p/offers?side=${side}&asset=${asset}&fiat=${fiat}`, { cache: "no-store" });
      const data = await readJson<{ offers: Offer[] }>(res);
      const list = data?.offers ?? [];
      const stamp = list
        .map((o) => `${o.id}:${o.price_value}:${o.price_margin ?? ""}:${o.min_amount}:${o.max_amount}:${o.ad_type}:${o.vendor.id}:${o.vendor.advertiserStatus}:${o.vendor.completionRate}:${o.vendor.totalTrades}:${o.vendor.avgReleaseSeconds}:${o.vendor.balance}`)
        .join("|");
      if (stamp !== offersStampRef.current) {
        offersStampRef.current = stamp;
        setOffers(list);
      }
    } finally {
      setOffersLoading(false);
    }
  }, [side, asset, fiat]);

  useEffect(() => {
    if (status === "authenticated") void loadOffers();
  }, [status, loadOffers]);

  // Vendors auto-refresh silently — new/updated offer lists appear without a refresh button.
  usePoll(() => {
    if (status === "authenticated") void loadOffers();
  }, { intervalMs: 15000, enabled: status === "authenticated" });

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
                loading={offersLoading && offers.length === 0}
                onSelect={(offer) => { setActiveTrade(null); setSelectedOffer(offer); }}
                activeTradesByAd={activeTradesByAd}
                onResume={(trade) => {
                  setActiveTrade(trade);
                  setSelectedOffer(null);
                  router.replace(`/p2p-marketplace/trade?side=${side}&trade=${trade.id}`, { scroll: false });
                }}
                favorites={favorites}
                pinned={pinned}
                blocked={blocked}
                favoritesOnly={favoritesOnly}
                onFavoritesOnlyChange={setFavoritesOnly}
                onToggleFavorite={toggleFavorite}
                onTogglePin={togglePin}
                onToggleBlock={toggleBlock}
                myUserId={myUserId}
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
                    void refetchActiveTrade(activeTrade.id);
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
