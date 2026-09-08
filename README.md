# Kwizerana Collab

Kwizerana Collab is a Next.js platform for discovering credible crypto voices and facilitating non-custodial P2P crypto trades. The repository contains a mature influencer-archive foundation and a substantial P2P prototype targeting USDT/USDC trades on Avalanche.

> **Production status:** the influencer archive is implemented but still needs operational hardening. The P2P marketplace is not approved for real-value production use. Escrow simulation, unverified client transaction hashes, database/chain consistency, and the prototype smart contract are explicit blockers. See `docs/PRODUCTION-READINESS.md`.

## Product areas

### Influencer archive

- Search and filter approved crypto X/Twitter profiles.
- View follower, biography, niche, verification, location, and freshness data.
- Submit profiles for review.
- Admin review, edit, refresh, approve, reject, and batch-submit profiles.
- Manage niche ranking boards.
- Store browser-local favorites and export results.
- Enrich profiles through XFlux with twitterapi.io and development fallback behavior.

### P2P marketplace

Current code includes:

- Email/password registration, Google sign-in, email verification, 2FA, backup codes, and anti-phishing codes.
- Wallet connection through RainbowKit/wagmi on Avalanche.
- USDT/USDC offers, fiat currencies, price feeds, payment methods, ads, vendor profiles, inventory, fees, and applications.
- Trades, receipts, chat, notifications, reviews, referrals, disputes, and administrative operations.
- A prototype ERC-20 escrow contract and browser integration.

Presence in code does not mean production verification. Current implementation status is tracked in `docs/p2p-marketplace/MILESTONES.md`.

## Stack

- Next.js 14 App Router, React 18, and TypeScript.
- Tailwind CSS and Lucide icons.
- Neon serverless PostgreSQL.
- NextAuth v4 with Google and a ticket-backed credentials flow.
- RainbowKit, wagmi, and viem.
- Avalanche C-Chain with native USDT/USDC addresses.
- Resend for email.
- CoinGecko for reference rates.
- XFlux/twitterapi.io for X profile data.

## Repository map

```text
app/                  Pages and API route handlers
components/           Shared UI and P2P components
contracts/            Prototype Solidity escrow
docs/                 Architecture, security, design, and roadmap
lib/                  Domain services and database access
lib/p2p/              P2P domain logic
lib/web3/             Wallet and contract integration
public/               Brand and static assets
scripts/              Database and escrow utility scripts
types/                Shared type augmentation
```

## Start here

- Contributors and AI agents: `AGENTS.md`.
- Product/interface direction: `DESIGN.md`.
- Architecture: `docs/ARCHITECTURE.md`.
- Roadmap: `docs/ROADMAP.md`.
- Launch blockers: `docs/PRODUCTION-READINESS.md`.
- Dashboard plan: `docs/DASHBOARD-PLAN.md`.
- P2P guide: `docs/p2p-marketplace/README.md`.
- Trade lifecycle: `docs/p2p-marketplace/TRADE-STATE-MACHINE.md`.
- Escrow risk: `docs/p2p-marketplace/ESCROW-SECURITY.md`.

## Local setup

Requirements: Node.js 18+, a Neon PostgreSQL database, and values from `.env.example`.

```bash
npm install
npm run dev
```

The development server normally runs at `http://localhost:3000`.

The application currently calls `ensureDatabase()` from domain services, which initializes schema from `lib/db.ts`. This is prototype behavior. Use `npm run db:setup` only for local/staging setup and do not treat runtime schema initialization as a production migration strategy.

## Environment groups

Use `.env.example` as the canonical variable list. Main groups are:

- Application and NextAuth URLs/secrets.
- Google OAuth and admin email configuration.
- Neon database connection.
- Resend email configuration.
- X profile provider configuration.
- WalletConnect and Avalanche RPC configuration.
- Escrow contract and deployment configuration.

Never commit environment files or deployer private keys. A production arbitrator/deployer key should not be stored as a normal web application environment variable.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run format
npm run db:setup
npm run deploy:escrow
```

`deploy:escrow` is a prototype utility, not approval to deploy the current contract with real funds.

## Development expectations

- Keep route handlers thin and business rules in `lib/`.
- Add versioned migrations before production database changes.
- Use exact decimal/integer handling for financial values.
- Verify on-chain receipts and events server-side.
- Update roadmap and milestones with evidence when behavior changes.
- Add tests for successful, failed, unauthorized, concurrent, and recovery paths.

## License

Private — Kwizerana.

