# P2P Marketplace Developer Guide

## Status

Kwizerana P2P is a substantial prototype for trading USDT/USDC against fiat with self-custody wallets and smart-contract escrow on Avalanche. It includes market, account, vendor, trade, dispute, notification, and admin functionality, but is **not approved for real-value production use**.

Read these before making P2P changes:

1. `../../AGENTS.md`
2. `../ARCHITECTURE.md`
3. `TRADE-STATE-MACHINE.md`
4. `ESCROW-SECURITY.md`
5. `../PRODUCTION-READINESS.md`
6. `MILESTONES.md`

## Intended model

- Users exchange fiat off-platform through an agreed payment method.
- The seller locks crypto in an Avalanche escrow contract.
- The buyer marks fiat paid and supplies a reference/evidence.
- The seller confirms receipt and releases the crypto.
- The buyer claims crypto according to the contract destination policy.
- An arbitrator resolves exceptional disputes under a transparent governance model.

The platform is intended to be non-custodial, but escrow temporarily holds tokens and arbitration introduces trust. Do not market it as fully trustless.

## What exists

### Implemented foundation

- Email/password and Google authentication, verification, 2FA, and anti-phishing settings.
- Public offer discovery for USDT/USDC and multiple fiat currencies.
- Payment methods, ads, vendor applications/profiles, declared inventory, rates, and fees.
- Trade creation and application-level state transitions.
- Trade detail, receipt capture, chat, notifications, reviews, disputes, and dashboards.
- Avalanche wallet integration and a prototype escrow contract.
- Cron routes for rate refresh and trade expiry.
- P2P admin routes for users, vendors, rates, verifications, and disputes.

### Partial or unsafe

- Escrow actions can be simulated when no contract address is configured.
- Server state trusts client-supplied transaction hashes.
- Chain events and confirmations are not verified/reconciled server-side.
- Trade state changes are not consistently atomic or row-locked.
- Funded expiry and dispute decisions are not reliably coupled to on-chain settlement.
- Current contract is not the documented 2-of-3 model and has no timeout.
- Inventory is vendor-declared, not proof of spendable or escrowed funds.
- Rate limiting and operational monitoring are insufficient for serverless production.

## Key code

- Market: `app/p2p-marketplace/page.tsx`.
- Trade entry/detail: `app/p2p-marketplace/trade/page.tsx`, `components/p2p/order-detail-view.tsx`.
- Dashboard: `app/dashboard/page.tsx`.
- Ads and disputes: `app/p2p/ads/`, `app/p2p/disputes/`.
- APIs: `app/api/p2p/`, `app/api/admin/`.
- Domain logic: `lib/p2p/`.
- Wallet/escrow integration: `lib/web3/`, `components/p2p/escrow-wallet.tsx`.
- Contract: `contracts/KwizeranaEscrow.sol`.
- Schema: `lib/db.ts`.

## Development order

1. Enforce the documented state machine and financial invariants.
2. Add wallet ownership and chain event verification.
3. Replace/harden the escrow contract and test it comprehensively.
4. Add reconciliation and operational queues.
5. Refactor dashboard/trade monoliths into domain components.
6. Complete UX, accessibility, failure-state, and mobile work.
7. Complete production-readiness and legal gates.

## Non-negotiable rules

- Browser success is not financial truth.
- A transaction hash is not proof until independently verified.
- Database expiry does not refund on-chain funds.
- Dispute resolution is incomplete until the chain outcome is confirmed.
- Demo hashes never appear as genuine explorer transactions.
- No real-value deployment before contract audit and P0 launch gates.

