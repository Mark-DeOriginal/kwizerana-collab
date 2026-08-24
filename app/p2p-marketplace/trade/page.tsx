"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowDownUp, Banknote, LogIn, Megaphone, Plus, Wallet } from "lucide-react";
import { readJson } from "@/lib/client-request";
import { ConnectWalletAction } from "@/components/p2p/ConnectWalletButton";
import { CRYPTO_CURRENCIES, type Currency, type CurrencyRate } from "@/lib/p2p/currencies-shared";
import type { UserPaymentMethod } from "@/lib/p2p/payment-methods-shared";

type Side = "buy" | "sell";

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function TradeClient() {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const initialSide: Side = searchParams.get("side") === "sell" ? "sell" : "buy";

  const [side, setSide] = useState<Side>(initialSide);
  const [asset, setAsset] = useState("USDT");
  const [fiat, setFiat] = useState("NGN");
  const [amount, setAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");

  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [rates, setRates] = useState<CurrencyRate[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<UserPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    Promise.all([
      fetch("/api/p2p/currencies", { cache: "no-store" }),
      fetch("/api/p2p/payment-methods", { cache: "no-store" })
    ])
      .then(([cRes, pRes]) => Promise.all([readJson<{ currencies: Currency[]; rates: CurrencyRate[] }>(cRes), readJson<{ methods: UserPaymentMethod[] }>(pRes)]))
      .then(([cData, pData]) => {
        setCurrencies(cData?.currencies ?? []);
        setRates(cData?.rates ?? []);
        setPaymentMethods(pData?.methods ?? []);
      })
      .finally(() => setLoading(false));
  }, [status]);

  const fiatCurrencies = useMemo(() => currencies.filter((c) => c.is_fiat), [currencies]);
  const rate = useMemo(() => rates.find((r) => r.crypto_currency === asset && r.fiat_currency === fiat), [rates, asset, fiat]);

  const amountNum = Number.parseFloat(amount) || 0;
  const fiatEstimate = rate ? amountNum * Number(rate.rate) : 0;

  if (status === "loading") {
    return <div className="px-4 py-24 text-center text-sm text-muted">Loading…</div>;
  }

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
      <div className="mx-auto max-w-[1200px]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">P2P Marketplace</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              {side === "buy" ? "Buy" : "Sell"} {asset}
            </h1>
          </div>
          <Link href="/p2p-marketplace" className="text-sm font-semibold text-ocean hover:underline">
            Back to marketplace
          </Link>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          {/* Order form */}
          <section className="border border-line bg-white">
            <div className="flex border-b border-line">
              <button
                onClick={() => setSide("buy")}
                className={`flex h-12 flex-1 items-center justify-center text-sm font-semibold transition-colors ${side === "buy" ? "border-b-2 border-ocean bg-panel text-ink" : "text-muted hover:text-ink"}`}
              >
                Buy
              </button>
              <button
                onClick={() => setSide("sell")}
                className={`flex h-12 flex-1 items-center justify-center text-sm font-semibold transition-colors ${side === "sell" ? "border-b-2 border-ocean bg-panel text-ink" : "text-muted hover:text-ink"}`}
              >
                Sell
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Asset</label>
                <select value={asset} onChange={(e) => setAsset(e.target.value)} className="h-11 w-full border border-line bg-white px-3 text-sm outline-none focus:border-ocean">
                  {CRYPTO_CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Fiat currency</label>
                <select value={fiat} onChange={(e) => setFiat(e.target.value)} className="h-11 w-full border border-line bg-white px-3 text-sm outline-none focus:border-ocean">
                  {fiatCurrencies.map((c) => (
                    <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Amount ({asset})</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-11 w-full border border-line bg-white px-3 text-sm outline-none focus:border-ocean"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Payment method</label>
                {paymentMethods.length === 0 ? (
                  <Link href="/account/payment-methods" className="flex h-11 items-center justify-between border border-dashed border-line bg-panel px-3 text-sm font-semibold text-ocean transition-colors hover:border-ocean">
                    <span>Add a payment method</span>
                    <Plus className="h-4 w-4" />
                  </Link>
                ) : (
                  <select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)} className="h-11 w-full border border-line bg-white px-3 text-sm outline-none focus:border-ocean">
                    <option value="" disabled>Select a payment method</option>
                    {paymentMethods.map((m) => (
                      <option key={m.id} value={m.id}>{m.method_name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center justify-between border border-line bg-panel px-3 py-3">
                <div className="text-sm">
                  <p className="text-muted">Estimated rate</p>
                  <p className="font-semibold">
                    {rate ? `1 ${asset} = ${formatNumber(Number(rate.rate))} ${fiat}` : "—"}
                  </p>
                </div>
                <ArrowDownUp className="h-4 w-4 text-ocean" />
                <div className="text-right text-sm">
                  <p className="text-muted">{side === "buy" ? "You pay" : "You receive"}</p>
                  <p className="font-semibold">
                    {fiatEstimate ? `${formatNumber(fiatEstimate)} ${fiat}` : "—"}
                  </p>
                </div>
              </div>

              <button className="flex h-11 w-full items-center justify-center gap-2 bg-ink text-sm font-semibold text-white transition-colors hover:bg-ocean">
                Find offers
              </button>
            </div>
          </section>

          {/* Offers */}
          <section className="border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="text-sm font-semibold">Available offers</h2>
              <span className="text-xs text-muted">{side === "buy" ? "Buy" : "Sell"} {asset} · {fiat}</span>
            </div>
            <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-panel text-muted ring-1 ring-line">
                <Megaphone className="h-6 w-6" />
              </span>
              <p className="mt-4 font-semibold">No offers yet</p>
              <p className="mt-1 max-w-sm text-sm leading-6 text-muted">
                Live offers are launching soon. In the meantime, make sure your wallet and payment methods are set up so you can trade right away.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <ConnectWalletAction className="flex h-10 items-center gap-2 bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean">
                  <Wallet className="h-4 w-4" />
                  Connect wallet
                </ConnectWalletAction>
                <Link href="/account/payment-methods" className="flex h-10 items-center gap-2 border border-line px-4 text-sm font-semibold transition-colors hover:border-ocean">
                  <Banknote className="h-4 w-4" />
                  Payment methods
                </Link>
              </div>
            </div>
          </section>
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
