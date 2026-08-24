"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight, ArrowUpRight, BadgeCheck, Banknote, LayoutDashboard, TrendingUp } from "lucide-react";

export function HeroActions() {
  const { status } = useSession();

  if (status === "authenticated") {
    return (
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href="/p2p-marketplace/trade?side=buy"
          className="flex h-12 items-center gap-2 bg-ocean px-6 text-sm font-semibold text-white transition-colors hover:bg-ocean/90"
        >
          <TrendingUp className="h-4 w-4" />
          Buy crypto
        </Link>
        <Link
          href="/p2p-marketplace/trade?side=sell"
          className="flex h-12 items-center gap-2 border border-white/20 bg-white/5 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          <Banknote className="h-4 w-4" />
          Sell crypto
        </Link>
        <Link
          href="/dashboard"
          className="flex h-12 items-center gap-2 text-sm font-semibold text-white/70 transition-colors hover:text-white"
        >
          <LayoutDashboard className="h-4 w-4" />
          My dashboard
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <Link
        href="/auth/sign-up"
        className="flex h-12 items-center gap-2 bg-ocean px-6 text-sm font-semibold text-white transition-colors hover:bg-ocean/90"
      >
        Create free account
        <ArrowRight className="h-4 w-4" />
      </Link>
      <a
        href="#how-it-works"
        className="flex h-12 items-center gap-2 border border-white/20 bg-white/5 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
      >
        How it works
      </a>
    </div>
  );
}

export function BottomCta() {
  const { status } = useSession();

  if (status === "authenticated") {
    return (
      <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1 text-xs font-semibold text-moss">
            <BadgeCheck className="h-3.5 w-3.5" />
            Live order book launching soon
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight">Ready when you are</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Connect your wallet and add your payment methods now, so you can buy and sell the moment offers go live.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/p2p-marketplace/trade" className="flex h-12 items-center justify-center gap-2 bg-ink px-6 text-sm font-semibold text-white transition-colors hover:bg-ocean">
            Start trading
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          <Link href="/dashboard" className="flex h-12 items-center justify-center gap-2 border border-line px-6 text-sm font-semibold transition-colors hover:border-ocean">
            My dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
      <div className="max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1 text-xs font-semibold text-moss">
          <BadgeCheck className="h-3.5 w-3.5" />
          Live order book launching soon
        </span>
        <h2 className="mt-4 text-3xl font-bold tracking-tight">Get ready to trade</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Create your account now, secure it with two-factor authentication, and add your payment methods — so you&apos;re ready the moment offers go live.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/auth/sign-up" className="flex h-12 items-center justify-center gap-2 bg-ink px-6 text-sm font-semibold text-white transition-colors hover:bg-ocean">
          Create account
          <ArrowUpRight className="h-4 w-4" />
        </Link>
        <a href="#how-it-works" className="flex h-12 items-center justify-center gap-2 border border-line px-6 text-sm font-semibold transition-colors hover:border-ocean">
          How it works
        </a>
      </div>
    </div>
  );
}
