# P2P Crypto Marketplace — Developer Guide

Quick reference for any AI agent or developer picking up this project.

---

## What This Is

A crypto peer-to-peer marketplace at `/p2p-marketplace` within the Kwizerana Collab platform. Users buy and sell crypto (USDT/USDC) directly with each other across multiple countries and fiat currencies. The platform provides escrow, dispute resolution, chat, and reputation — modeled on Bybit P2P, Binance P2P, Paxful, and LocalBitcoins.

**Core design principles:**
- **Multi-country & multi-currency** — users in any supported country trade; buyers pick their fiat currency (NGN, USD, EUR, KES, GHS, etc.), each with its own rate against USDT/USDC.
- **Non-custodial / decentralized** — no platform wallet holds user funds. Users connect their own wallet (MetaMask/WalletConnect/Phantom/TronLink).
- **Sell flow:** seller connects wallet, posts ad → crypto is **debited from seller's wallet** into an escrow smart contract on trade initiation.
- **Buy flow:** buyer connects wallet → after seller confirms fiat cash received, crypto is **credited to buyer's wallet** from escrow.

## How Top P2P Platforms Work (Key Research Findings)

The mechanics are identical across Binance, Bybit, Paxful, and LocalBitcoins:

1. **Seller posts an ad** — sets price (fixed or floating margin), payment methods, min/max limits
2. **Buyer initiates trade** — platform locks seller's crypto in escrow
3. **Buyer pays fiat off-platform** — bank transfer, mobile money, etc. (platform never touches fiat)
4. **Seller confirms receipt** — escrow releases crypto to buyer
5. **Dispute if something goes wrong** — human moderator reviews evidence, rules who gets funds

**Our difference:** instead of custodial escrow (platform hot/cold wallets), we use **non-custodial smart-contract escrow** with wallet-connect — a 2-of-3 multisig (buyer + seller + platform arbitrator key) on Ethereum/BSC/Polygon/Tron/Solana.

**Critical insights from research:**
- **Escrow is the trust layer.** Without bulletproof escrow, it's a classifieds board, not a marketplace.
- **Dispute resolution is the #1 operating cost.** Every trade has an off-chain fiat leg that can go wrong.
- **The merchant/advertiser model is the liquidity engine.** Bybit uses a two-tier system (General: Beginner/Regular/Veteran + Verified: Bronze/Silver/Gold) with security deposits, completion-rate thresholds, and per-level trade limits.
- **Completion rate (30-day) is THE trust metric.** Below 90% is a red flag.
- **Cost is driven by spreads (2.5-3.5%), not fees.** Takers often pay 0% fee; makers pay.

## Project Files

| File | Purpose |
|------|---------|
| `docs/p2p-marketplace/FEATURES.md` | Complete feature list (17 sections) |
| `docs/p2p-marketplace/MILESTONES.md` | Development phases and progress tracker |
| `docs/p2p-marketplace/DATABASE-SCHEMA.md` | All database tables, indexes, and enums |
| `docs/p2p-marketplace/README.md` | This file — developer quick reference |

## Existing Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** Neon PostgreSQL via `@neondatabase/serverless`
- **Auth:** NextAuth.js (Google OAuth)
- **Styling:** Tailwind CSS
- **DB helpers:** `lib/db.ts` (exports `dbQuery`, `ensureDatabase`)
- **Roles:** `lib/roles.ts` (admin, member roles + permissions)
- **Web3 (to add):** wagmi + viem (EVM), WalletConnect, TronWeb, Solana wallet adapter

## How to Build

1. **Database first** — Add schema statements to `lib/db.ts` schemaStatements array
2. **API routes** — Create under `app/api/p2p/` (e.g., `app/api/p2p/ads/route.ts`)
3. **Pages** — Create under `app/p2p-marketplace/` (e.g., `app/p2p-marketplace/page.tsx`)
4. **Components** — Create under `components/p2p/`
5. **Shared logic** — Create under `lib/p2p/`

## Key Patterns to Follow

### Database queries
```typescript
import { dbQuery } from "@/lib/db";

// Always use parameterized queries
const rows = await dbQuery("SELECT * FROM p2p_ads WHERE status = $1", ["active"]);
```

### API routes
```typescript
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ... handle request
}
```

### Page components
```typescript
"use client";
// Use existing patterns from app/page.tsx
// Tailwind classes: ocean, ink, mint, moss, coral, line, panel, muted
```

## Development Order

Start with Phase 1 (Foundation) and work sequentially through milestones in `MILESTONES.md`. Each phase builds on the previous one.

**Phase 1 must be completed first** — it sets up the database tables that everything else depends on.

### Critical Build Order (from research)
1. **Escrow first** — it's the foundation of trust
2. **Trade state machine** — get the happy path working end-to-end
3. **Dispute resolution** — the #1 operating cost, build it properly
4. **Advertiser/merchant system** — the liquidity engine
5. **Reputation/completion rate** — the trust signal
6. **Payment methods** — expand based on target market demand
7. **Security/fraud prevention** — triangle scam, wash trading, reversal

## Launch Notes

- **Seed liquidity first:** recruit 10-20 merchants before public launch; offer fee waivers
- **Launch multi-currency from day one:** USDT/USDC against major fiat currencies (NGN, USD, EUR, KES, GHS, etc.)
- **Resolve disputes fast:** response time IS the brand
- **Mobile-first:** 80%+ of P2P trades happen on mobile

## Notes

- All times are UTC
- Currency amounts use NUMERIC (not FLOAT) for precision
- Trade references are unique strings (e.g., "TR-ABC123")
- Chat messages are only available during active trades
- Escrow is non-custodial (smart contract with 2-of-3 multisig — platform holds only the arbitrator key)
- No KYC — trade limits are determined by advertiser level and completion rate
- Trust score is calculated, not stored raw (recalculated from trade history)
- Completion rate (30-day) is the primary trust signal
- Fiat settlement happens off-platform; platform only mediates crypto (via smart contract) + disputes
- Users connect their own wallet — no platform deposits or withdrawals
