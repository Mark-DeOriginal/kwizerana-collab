import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CircleCheck, CreditCard, UsersRound } from "lucide-react";

const tradeSteps = [
  {
    icon: UsersRound,
    title: "Choose an offer",
    body: "Compare the rate, limits, payment method, and seller history before you open a trade."
  },
  {
    icon: CreditCard,
    title: "Complete the payment",
    body: "Send the exact fiat amount using the payment instructions shown inside the trade."
  },
  {
    icon: CircleCheck,
    title: "Release and receive",
    body: "After the seller confirms receipt, the crypto is released from escrow to the buyer's wallet."
  }
];

export default function P2PMarketplacePage() {
  return (
    <div className="bg-[#fbfcfa] text-ink">
      <section className="mx-auto grid max-w-[1280px] gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-8 lg:py-24">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">People to people. A clearer way to trade.</p>
          <h1 className="mt-6 text-5xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-[4.8rem]">
            Trade crypto directly. Keep control of your funds.
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-8 text-muted">
            Buy and sell USDT or USDC with another person using a payment method that works for both of you. Kwizerana keeps the crypto in escrow while the payment is completed.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-5">
            <Link href="/p2p-marketplace/trade" className="inline-flex h-12 items-center gap-2 rounded-md bg-ocean px-6 text-sm font-semibold text-white hover:bg-ink">
              Browse offers <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#how-it-works" className="inline-flex h-12 items-center gap-2 text-sm font-semibold text-ocean hover:text-ink">
              See how it works <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-panel">
          <Image
            src="/images/p2p/peer-payment-hero.png"
            alt="Two people using their phones to complete a direct payment"
            width={1376}
            height={1147}
            priority
            className="aspect-[1.12/1] h-full w-full object-cover"
          />
        </div>
      </section>

      <section id="how-it-works" className="border-b border-line bg-white">
        <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">How it works</p>
          <h2 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.04] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
            A direct trade, with escrow in the middle.
          </h2>
          <div className="mt-8 grid max-w-5xl gap-6 text-base leading-7 text-muted md:grid-cols-2 md:gap-16">
            <p>You and another user agree on the price, amount, and payment method. The local payment moves directly between both parties.</p>
            <p>The seller&apos;s crypto is locked in smart-contract escrow during the trade and can only move through the defined trade process.</p>
          </div>

          <ol className="mt-16 grid gap-10 md:grid-cols-3 md:gap-0">
            {tradeSteps.map((step, index) => (
              <li key={step.title} className="border-line md:border-l md:px-8 md:first:border-l-0 md:first:pl-0">
                <div className="flex items-center justify-between">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-mint text-moss"><step.icon className="h-6 w-6" /></span>
                  <span className="text-sm font-semibold tabular-nums text-muted/60">0{index + 1}</span>
                </div>
                <h3 className="mt-7 text-xl font-semibold">{step.title}</h3>
                <p className="mt-3 max-w-xs text-sm leading-6 text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="relative isolate overflow-hidden bg-[#eaf3eb]">
        <Image src="/images/p2p/escrow-still-life.png" alt="A stone representing stability and protection" fill className="-z-10 object-cover object-center opacity-90" sizes="100vw" />
        <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">What escrow protects</p>
            <h2 className="mt-5 text-4xl font-semibold leading-[1.04] tracking-[-0.035em] sm:text-5xl">Crypto is held while payment is completed.</h2>
            <p className="mt-6 text-base leading-7 text-muted">
              Escrow protects the crypto side of the trade. Fiat payments still happen between users, so follow the listed instructions and keep all trade communication on Kwizerana.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-8 px-4 py-20 sm:px-6 md:flex-row md:items-end lg:px-8 lg:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Ready when you are</p>
            <h2 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-[-0.035em] sm:text-5xl">Find an offer that works for both sides.</h2>
          </div>
          <Link href="/p2p-marketplace/trade" className="inline-flex h-12 shrink-0 items-center gap-2 rounded-md bg-ink px-6 text-sm font-semibold text-white hover:bg-ocean">
            Browse offers <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
