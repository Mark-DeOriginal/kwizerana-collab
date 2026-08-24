"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { ArrowUpRight, LayoutDashboard, Lock, Scale, Wallet } from "lucide-react";

export function Footer() {
  const { status } = useSession();
  const signedIn = status === "authenticated";

  return (
    <footer className="border-t border-line bg-ink text-white">
      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          {/* Brand */}
          <div className="max-w-sm">
            <Link href="/" className="flex items-center">
              <Image src="/kwizerana-logo.svg" alt="Kwizerana" width={28} height={28} className="h-7 w-auto shrink-0" />
            </Link>
            <p className="mt-4 text-sm leading-6 text-white/60">
              A decentralized, non-custodial marketplace for trading crypto peer to peer. Trust built on reputation, not paperwork.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-white/70">
              <li className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-mint" />
                Self-custody wallets
              </li>
              <li className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-mint" />
                No KYC required
              </li>
              <li className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-mint" />
                Escrow-protected trades
              </li>
            </ul>
          </div>

          {/* Product */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Product</p>
            <ul className="mt-4 space-y-3 text-sm font-semibold">
              <li>
                <Link href="/" className="text-white/70 transition-colors hover:text-white">
                  Influencer archive
                </Link>
              </li>
              <li>
                <Link href="/p2p-marketplace" className="flex items-center gap-1.5 text-white/70 transition-colors hover:text-white">
                  P2P Marketplace
                  <ArrowUpRight className="h-3.5 w-3.5 text-mint" />
                </Link>
              </li>
              <li>
                <Link href="/p2p-marketplace/trade" className="text-white/70 transition-colors hover:text-white">
                  Buy / Sell crypto
                </Link>
              </li>
              <li>
                <Link href="/submit-profile" className="text-white/70 transition-colors hover:text-white">
                  Submit a profile
                </Link>
              </li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Account</p>
            <ul className="mt-4 space-y-3 text-sm font-semibold">
              {signedIn ? (
                <>
                  <li>
                    <Link href="/dashboard" className="flex items-center gap-1.5 text-white/70 transition-colors hover:text-white">
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      My dashboard
                    </Link>
                  </li>
                  <li>
                    <Link href="/account/security" className="text-white/70 transition-colors hover:text-white">
                      Security settings
                    </Link>
                  </li>
                  <li>
                    <Link href="/account/payment-methods" className="text-white/70 transition-colors hover:text-white">
                      Payment methods
                    </Link>
                  </li>
                  <li>
                    <button onClick={() => void signOut()} className="text-white/70 transition-colors hover:text-white">
                      Sign out
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link href="/auth/sign-in" className="text-white/70 transition-colors hover:text-white">
                      Sign in
                    </Link>
                  </li>
                  <li>
                    <Link href="/auth/sign-up" className="text-white/70 transition-colors hover:text-white">
                      Create account
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Start trading */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Start trading</p>
            <p className="mt-4 text-sm leading-6 text-white/60">
              {signedIn
                ? "Connect your wallet and add payment methods to be ready when offers go live."
                : "Create a free account, connect your wallet, and trade USDT & USDC peer to peer."}
            </p>
            {signedIn ? (
              <Link
                href="/p2p-marketplace/trade"
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-ocean px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean/90"
              >
                Start trading
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                href="/auth/sign-up"
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-ocean px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean/90"
              >
                Get started
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/50">&copy; {new Date().getFullYear()} Kwizerana. All rights reserved.</p>
          <p className="text-xs text-white/50">Trade responsibly. Crypto markets carry risk.</p>
        </div>
      </div>
    </footer>
  );
}
