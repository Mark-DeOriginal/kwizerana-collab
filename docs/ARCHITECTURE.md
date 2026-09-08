# Architecture

## System overview

Kwizerana Collab is a Next.js 14 App Router application backed by Neon PostgreSQL. It contains an influencer archive and an Avalanche-focused P2P crypto marketplace.

```text
Browser
  |-- public/archive and dashboard React pages
  |-- NextAuth session
  |-- RainbowKit/wagmi wallet connection
  v
Next.js route handlers
  |-- auth and authorization
  |-- domain services in lib/
  |-- external profile, email, and price providers
  |-- Neon PostgreSQL
  `-- Avalanche escrow contract (client currently submits transactions)
```

## Main modules

### Influencer archive

- Public archive: `app/page.tsx`, `app/api/archive/route.ts`, `lib/influencers.ts`.
- Submission: `app/submit-profile/`, `app/api/submissions/`, `lib/submissions.ts`.
- Admin review: `app/review-profiles/`, `app/api/admin/submissions/`.
- Ranking boards: `components/RankingsTab.tsx`, ranking API routes, `lib/rankings.ts`.
- X profile providers and fallback data: `lib/twitter-profile.ts`.

### Identity and access

- NextAuth configuration: `lib/auth.ts`.
- Google OAuth and ticket-backed email/password sign-in.
- Password helpers: `lib/auth/password.ts`.
- Signed challenges/tickets: `lib/auth/signing.ts`, `lib/auth/tickets.ts`.
- P2P 2FA: `lib/p2p/two-factor.ts`.
- Roles and permissions: `lib/roles.ts`.

### P2P marketplace

- Market and trade pages: `app/p2p-marketplace/`.
- Member/vendor dashboard: `app/dashboard/`.
- Ads management: `app/p2p/ads/`, `lib/p2p/ads.ts`.
- Offer discovery/pricing: `lib/p2p/offers.ts`, `lib/p2p/price-feed.ts`.
- Trades: `lib/p2p/trades.ts` and `app/api/p2p/trades/`.
- Escrow UI: `components/p2p/escrow-wallet.tsx`.
- Disputes, chat, reviews, notifications, referrals, payment methods, vendors, fees, and wallet records: corresponding modules under `lib/p2p/`.
- Administration: `app/admin-dashboard/` and `app/api/admin/`.

### Web3

- Wallet configuration: `lib/web3/config.ts`.
- Contract ABI and token/address helpers: `lib/web3/escrow.ts`.
- Prototype contract: `contracts/KwizeranaEscrow.sol`.
- Current target: Avalanche C-Chain and native Avalanche USDT/USDC contracts.

## Data architecture

`lib/db.ts` currently owns both database access and schema creation. `ensureDatabase()` executes a large list of idempotent DDL and data-update statements under a PostgreSQL advisory lock.

This is convenient for prototypes but must be replaced by versioned migrations before production. Runtime requests should not perform schema migrations or unconditional data correction.

Important domains include users, influencers, submissions, ranking boards, P2P wallets, currencies/rates, payment methods, ads, trades, escrow records, disputes, chat, reviews, notifications, advertiser applications, verification, referrals, inventory, and auth tickets.

## Current consistency model

The database is presently treated as the application state source, while blockchain actions originate in the browser. The browser submits a transaction hash back to the server, and the server advances state without independently verifying the receipt or event.

That model is unsafe for real-value settlement. The production model must be:

1. User signs and broadcasts a transaction.
2. Server receives a hash only as a hint.
3. A chain verifier fetches the receipt and required confirmations.
4. Contract address, chain, event signature, trade ID, actor, token, amount, and recipient are verified.
5. A transactional/idempotent state transition is applied.
6. A reconciliation worker continuously compares contract events with database state.

See `docs/p2p-marketplace/TRADE-STATE-MACHINE.md`.

## External services

- Neon PostgreSQL for persistent data.
- NextAuth for sessions.
- Google OAuth as an optional sign-in provider.
- Resend for verification and notification email.
- XFlux or twitterapi.io for X profile data.
- CoinGecko for fiat/crypto reference rates.
- Avalanche RPC for wallet and contract interactions.
- WalletConnect/Reown for supported wallet connections.

Provider failures need timeouts, structured errors, retries where safe, caching, circuit breaking, and observable fallback behavior.

## Target boundaries

- UI components render state and gather intent; they do not decide financial truth.
- Route handlers authenticate, validate, and delegate.
- Domain services own authorization and business invariants.
- Repositories/queries own persistence and transactions.
- Chain adapters own RPC reads, receipt/event validation, and confirmations.
- Workers own reconciliation, expiry, retry, and notification delivery.
- Contracts own escrow balances and enforce settlement invariants.

## Known architectural debt

- Very large page components combine data fetching, state, dialogs, and multiple workflows.
- Schema management and runtime querying share one module.
- Financial mutations lack transaction boundaries and row locks.
- Authorization patterns are duplicated across route handlers.
- Some development bypasses are distributed through admin routes.
- Rate limiting is per-process memory only.
- There is no automated test suite or CI workflow in the repository.
- Documentation has historically described intentions rather than verified behavior.

