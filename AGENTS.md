# Kwizerana Collab Agent Guide

This file is the first source of truth for AI agents and contributors working in this repository. Read it together with `README.md`, `DESIGN.md`, `docs/ARCHITECTURE.md`, and `docs/PRODUCTION-READINESS.md` before making changes.

## Product

Kwizerana Collab currently combines two products:

1. A curated directory and ranking system for crypto X/Twitter influencers.
2. A non-custodial P2P marketplace for exchanging USDT/USDC and fiat, currently targeting Avalanche C-Chain.

The P2P implementation is a functional prototype, not a production-ready financial system. Never describe simulated escrow or an unverified client transaction hash as a completed on-chain transfer.

## Required reading by task

- UI or UX: `DESIGN.md` and `docs/DASHBOARD-PLAN.md`.
- P2P workflows: `docs/p2p-marketplace/TRADE-STATE-MACHINE.md`.
- Smart contract or wallet work: `docs/p2p-marketplace/ESCROW-SECURITY.md` and `docs/p2p-marketplace/DEPLOY-ESCROW.md`.
- Database work: `docs/p2p-marketplace/DATABASE-SCHEMA.md`.
- Authentication or authorization: `docs/auth-setup.md` and `docs/PRODUCTION-READINESS.md`.
- Roadmap or status: `docs/ROADMAP.md` and `docs/p2p-marketplace/MILESTONES.md`.

## Architecture boundaries

- `app/`: Next.js App Router pages and route handlers.
- `components/`: reusable UI. P2P-specific components live in `components/p2p/`.
- `lib/`: database, domain, authentication, provider, and formatting logic.
- `lib/p2p/`: P2P domain services.
- `lib/web3/`: wallet and escrow client configuration.
- `contracts/`: Solidity contracts. The current escrow contract is a prototype.
- `docs/`: product, architecture, security, and operating decisions.

Keep route handlers thin. Validate input, authenticate the caller, call a domain service, and return a deliberate response. Business rules belong in `lib/`, not large page components or route handlers.

## Safety rules

- Do not enable real-value trading until every P0 item in `docs/PRODUCTION-READINESS.md` is complete.
- Never trust a client-supplied wallet address, transaction hash, amount, token, chain, role, price, fee, or state transition without server-side verification.
- A database state transition that represents an on-chain action must be derived from a confirmed contract event, not browser success alone.
- Use database transactions, row-level locking, idempotency keys, and explicit allowed transitions for trade mutations.
- Do not leave escrow simulation available in production.
- Do not deploy or upgrade the escrow contract without automated tests, testnet verification, and an independent security review.
- Do not log secrets, passwords, TOTP secrets, backup codes, private keys, complete payment credentials, verification tokens, or sensitive receipts.
- Do not commit `.env`, `.env.local`, private keys, production database URLs, or real customer data.
- Do not add KYC claims. The current product direction is reputation-based and no-KYC; legal review may still require changes before launch.

## Product and design rules

- Extend the existing Kwizerana identity rather than replacing it with a generic crypto dashboard.
- Prefer clear hierarchy, restrained surfaces, real data, and task-first layouts over decorative cards and gradients.
- Financial screens must always show the asset, network, amount, rate, fees, counterparty role, escrow status, required actor, and next action.
- Every async experience needs loading, empty, success, error, retry, expired, and permission-denied states where applicable.
- All interactive controls must work with keyboard input, have visible focus, and expose accessible labels and state.
- Break up oversized pages as they are touched. Avoid creating another multi-purpose page component.

## Change discipline

Before changing code:

1. Establish the current behavior from code, not only from documentation.
2. State the security and data-integrity implications.
3. Update the relevant plan/status document when scope or status changes.
4. Preserve unrelated user changes.

Before marking work complete:

1. Run the smallest relevant validation.
2. Test unhappy paths and authorization, not only the happy path.
3. Confirm responsive and keyboard behavior for UI work.
4. Confirm database and on-chain state cannot diverge for P2P work.
5. Update `docs/ROADMAP.md` and `docs/p2p-marketplace/MILESTONES.md` with evidence.

## Status vocabulary

Use these terms consistently:

- **Implemented:** present in code and usable in its intended environment.
- **Partial:** present but missing important behavior, validation, or integration.
- **Simulated:** UI/server behavior exists without a real external or on-chain effect.
- **Unsafe for production:** creates unacceptable financial, privacy, security, or integrity risk.
- **Planned:** documented but not materially implemented.
- **Verified:** tested with recorded evidence appropriate to the risk.

Do not change a milestone to complete merely because matching files exist.

## Current critical facts

- The root metadata still emphasizes the influencer archive while P2P is now a major product area.
- Database schema changes are currently run from `lib/db.ts` at runtime; a migration system is required before production.
- The in-memory rate limiter is not sufficient for a multi-instance deployment.
- The current P2P server accepts client-provided transaction hashes without chain-event verification.
- The current Solidity contract is not the documented 2-of-3 multisig and has no on-chain timeout.
- The milestone documentation historically lagged behind implementation; keep it synchronized from now on.

