import {
  BadgeCheck,
  Coins,
  Globe2,
  Lock,
  Scale,
  ShieldCheck,
  Smartphone,
  Users,
  Wallet
} from "lucide-react";
import { HeroActions, BottomCta } from "@/components/p2p/MarketplaceCta";
import { CRYPTO_CURRENCIES, FIAT_CURRENCIES } from "@/lib/p2p/currencies-shared";
import { PAYMENT_METHOD_CATEGORY_LABELS, SUPPORTED_METHODS } from "@/lib/p2p/payment-methods-shared";

const features = [
  {
    icon: ShieldCheck,
    title: "Escrow-protected",
    body: "Every trade is held in a non-custodial smart-contract escrow until both sides confirm. Funds are never held by the platform."
  },
  {
    icon: Wallet,
    title: "Self-custody",
    body: "Connect your own wallet — MetaMask, WalletConnect, Phantom, or TronLink. Your crypto stays in your control until you trade."
  },
  {
    icon: Lock,
    title: "No KYC required",
    body: "Trade freely without submitting government ID. Trust is built on reputation, not identity documents."
  },
  {
    icon: Globe2,
    title: "Multi-currency",
    body: "Trade USDT and USDC against fiat currencies across Africa, Europe, the Americas, Asia, and the Middle East."
  },
  {
    icon: Scale,
    title: "Fair dispute resolution",
    body: "Independent moderators review evidence and rule quickly when trades go wrong — the arbitrator key only acts on disputes."
  },
  {
    icon: Users,
    title: "Reputation that matters",
    body: "Completion rate, trading volume, and counterparties build your trust score. Verified advertisers stand out."
  }
];

const steps = [
  { icon: Wallet, title: "Connect your wallet", body: "Link your own non-custodial wallet. No platform deposits — ever." },
  { icon: Coins, title: "Find an offer", body: "Browse offers by crypto, fiat currency, payment method, and amount." },
  { icon: ShieldCheck, title: "Trade in escrow", body: "Crypto locks into escrow while you settle the fiat leg off-platform." },
  { icon: BadgeCheck, title: "Release & rate", body: "Confirm receipt, release funds, and rate your counterparty." }
];

function groupByRegion() {
  const map = new Map<string, typeof FIAT_CURRENCIES>();
  for (const c of FIAT_CURRENCIES) {
    const list = map.get(c.region) ?? [];
    list.push(c);
    map.set(c.region, list);
  }
  return Array.from(map.entries());
}

function groupByCategory() {
  const map = new Map<string, typeof SUPPORTED_METHODS>();
  for (const m of SUPPORTED_METHODS) {
    const list = map.get(m.category) ?? [];
    list.push(m);
    map.set(m.category, list);
  }
  return Array.from(map.entries());
}

export default function P2PMarketplacePage() {
  const regions = groupByRegion();
  const methodCategories = groupByCategory();

  return (
    <div className="text-ink">
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-white">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 80% at 80% 0%, rgba(47,111,145,0.35) 0%, transparent 60%), radial-gradient(50% 60% at 0% 100%, rgba(216,239,224,0.08) 0%, transparent 60%)"
          }}
        />
        <div className="relative mx-auto max-w-[1200px] px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-surface/5 px-3 py-1 text-xs font-semibold tracking-wide text-mint">
            <Lock className="h-3.5 w-3.5" />
            Non-custodial · No KYC required
          </span>

          <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Buy &amp; sell crypto, <span className="text-mint">peer to peer</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/70">
            Trade USDT and USDC directly with other people in your local currency. Escrow-protected, self-custodial, and built on trust — not paperwork.
          </p>

          <HeroActions />

          <dl className="mt-14 grid grid-cols-2 gap-6 border-t border-white/10 pt-8 sm:grid-cols-4">
            {[
              { value: "0%", label: "Taker fees at launch" },
              { value: "15+", label: "Fiat currencies" },
              { value: "2", label: "Assets — USDT & USDC" },
              { value: "2-of-3", label: "Escrow multisig" }
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-2xl font-bold sm:text-3xl">{stat.value}</dt>
                <dd className="mt-1 text-sm text-white/60">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">Why Kwizerana</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Built for trust, not custody</h2>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="group border border-line bg-surface p-6 transition-colors hover:border-ocean">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-mint text-ocean ring-1 ring-ocean/15">
                <feature.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Currencies */}
      <section className="border-y border-line bg-panel/60">
        <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">Markets</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Supported currencies</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
                Trade {CRYPTO_CURRENCIES.join(" and ")} against fiat across five regions.
              </p>
            </div>
            <span className="flex items-center gap-2 border border-line bg-surface px-3 py-2 text-sm font-semibold text-muted">
              <Coins className="h-4 w-4 text-ocean" />
              {CRYPTO_CURRENCIES.join(" · ")}
            </span>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {regions.map(([region, currencies]) => (
              <div key={region}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{region}</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {currencies.map((c) => (
                    <li key={c.code} className="flex items-center gap-2 border border-line bg-surface px-3 py-1.5 text-sm font-semibold">
                      {c.code}
                      <span className="text-xs font-normal text-muted">{c.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Payment methods */}
      <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">Payment methods</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Pay the way you want</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
          Bank transfers, mobile money, digital wallets, and more — expanded based on regional demand.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {methodCategories.map(([category, methods]) => (
            <div key={category} className="border border-line bg-surface p-5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-panel text-ocean ring-1 ring-line">
                <Smartphone className="h-4 w-4" />
              </span>
              <h3 className="mt-3 font-semibold">{PAYMENT_METHOD_CATEGORY_LABELS[category] ?? category}</h3>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {methods.map((m) => (
                  <li key={m.slug} className="border border-line bg-panel px-2 py-1 text-xs font-semibold text-ink">
                    {m.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-line bg-ink text-white">
        <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mint">How it works</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Four steps to your first trade</h2>

          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <li key={step.title} className="relative border border-white/10 bg-surface/5 p-6">
                <span className="absolute right-4 top-4 text-5xl font-bold text-white/10">{index + 1}</span>
                <span className="grid h-11 w-11 place-items-center rounded-full bg-ocean text-white">
                  <step.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 lg:px-8">
        <div className="border border-line bg-surface p-8 sm:p-10">
          <BottomCta />
        </div>
      </section>
    </div>
  );
}
