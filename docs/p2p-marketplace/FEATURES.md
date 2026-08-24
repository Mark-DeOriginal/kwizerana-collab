# P2P Crypto Marketplace — Feature Plan

A comprehensive plan for building a production-ready crypto peer-to-peer marketplace at `/p2p-marketplace` within the Kwizerana Collab platform.

Modeled on the mechanics of Bybit P2P, Binance P2P, Paxful, and LocalBitcoins — the industry-standard reference implementations.

---

## 1. User System & Authentication

### 1.1 Registration & Login
- Email + password registration
- Google OAuth (already exists in Kwizerana)
- Two-factor authentication (2FA) via TOTP authenticator apps
- **Anti-phishing code** — user sets a unique code that appears in all official platform emails so they can verify message authenticity
- Session management with device tracking
- Login history and active session display

### 1.2 User Profiles
- Display name, avatar, bio
- Member since date
- **P2P User Center** — a dedicated profile page with trade statistics:
  - Completed trades, completion rate (30-day), total trades
  - Average release time
  - Cumulative counterparties (unique trading partners)
  - 30-day trading volume
  - Trust/risk score
- Verified badge (verified advertiser)
- Advertiser badges (see Section 9 for the tier system)
- Online/offline status indicator
- Active hours display

### 1.3 Identity & Privacy (No KYC)
Kwizerana Collab is a decentralized, non-custodial marketplace. There is **no KYC** requirement and no collection of government identity documents:
- **Self-custody:** users trade directly from their own non-custodial wallets; the platform never holds user funds.
- **No identity documents:** no passport/ID/selfie collection and no liveness checks.
- **Optional payment-account binding:** users may optionally bind a payment account (confirming they control a bank/mobile-money account) to signal trust — never required to trade.
- **Reputation over identity:** trust is built from on-platform behavior — completion rate, trading volume, unique counterparties, and post-trade ratings.
- **Risk controls:** trade limits are driven by advertiser level and completion rate, not KYC tier.

---

## 2. Advertisement (Listing) System

### 2.1 Create Ad
- **Direction:** Buy or Sell (the user's own choice)
  - **Sell ad:** user offers to sell USDT/USDC for fiat cash
  - **Buy ad:** user offers to buy USDT/USDC with fiat cash
- **Cryptocurrency:** USDT, USDC (primary); expandable (BTC, ETH, SOL, etc.)
- **Fiat currency:** Any supported currency — NGN, USD, EUR, GBP, KES, GHS, ZAR, etc. Each fiat currency has its own rate against USDT/USDC.
- **Price type:** Fixed price or Floating (percentage margin above/below market index)
- **Price source:** Real-time index (CoinGecko / CoinMarketCap) providing the USDT/USDC rate in each fiat currency
- **Payment methods accepted:** Select from supported methods per ad (bank transfer, mobile money, etc.)
- **Min/max trade limits:** Configurable per ad, capped by advertiser level
- **Trade instructions:** Free text including required payment reference format
- **Payment reference code:** Unique per-trade reference (e.g., "P2P-USDT-31JAN") that the buyer must include
- **Auto-reply message:** Optional message sent when trade is initiated
- **Online hours:** When the seller is typically available
- **Wallet required:** The ad creator must connect a wallet to post a sell ad (crypto is debited from it on trade initiation)

### 2.2 Manage Ads
- Edit, pause / resume (inactive mode), delete, duplicate ads
- Ad status: Active, Inactive, Expired, Under Review
- Auto-hide if seller goes offline too long
- **Max active currency pairs per direction** enforced by advertiser level

### 2.3 Ad Visibility & Sorting
- Filtered by crypto, fiat, payment method, amount
- **Advertiser sorting rules:**
  - Verified advertisers rank above general advertisers
  - Higher completion rates rank higher
  - Priority placement for promoted ads (paid boost)
- Real-time price updates for floating-price ads

### 2.4 One-Click Buy / Sell
- **One-Click Buy:** auto-selects a qualifying ad based on desired amount and currency
- Streamlines beginner experience (2 taps instead of manual filtering)
- Auto-matched seller guaranteed by system
- Note: auto-matched rate may carry a premium over manual selection

---

## 3. Trade Flow (Core Transaction)

### 3.1 Trade Lifecycle
```
Created -> Pending Payment -> Payment Sent -> Completed
                                            -> Disputed (Appeal)
                                            -> Cancelled (timeout / buyer cancel)
```

### 3.2 Steps (Sell flow — crypto for fiat)
1. **Seller** connects wallet and posts a sell ad (USDT/USDC for fiat)
2. **Buyer** connects wallet, selects ad (or One-Click Buy), enters amount, reviews terms
3. **Escrow debits seller's wallet** — crypto moved from seller's wallet into the escrow smart contract (via `approve` + `transferFrom` on trade initiation)
4. Buyer sees seller payment details + payment reference code
5. Buyer sends fiat via agreed payment method (outside platform)
6. Buyer uploads payment proof, clicks "Payment Sent"
7. Seller verifies they received the cash, clicks "Payment Received"
8. **Escrow credits buyer's wallet** — crypto released from the contract to the buyer's address
9. Both parties rate each other (feeds completion rate + trust)

### 3.3 Trade Timers
- Bank transfer: 30 minutes
- Mobile money: 15 minutes
- Cash deposit: 60 minutes
- Buyer timeout -> auto-cancel, escrow returns crypto to seller's wallet
- Seller confirmation window after "Payment Sent" -> auto-release or admin review (configurable)
- **Escrow time-lock fallback:** if no action within 72 hours, funds return to seller

### 3.4 Payment Proof Requirements
- Screenshot of payment confirmation with timestamp, amount, recipient, reference
- Transaction ID / reference number (required for appeals)
- Warn buyer to keep proof until trade completes

---

## 4. Escrow System (Non-Custodial / Decentralized)

### 4.1 Mechanics
- **No platform custodial wallet** — the platform never holds user funds long-term
- On trade initiation, crypto is **debited from the seller's connected wallet** into an escrow smart contract
- On completion, crypto is **credited to the buyer's connected wallet** from the contract
- Released on: seller confirmation, dispute ruling, or auto-release/timeout
- Status visible to both parties at every step (transparency is non-negotiable)
- Partial release support for partial payments (optional)

### 4.2 Escrow Smart Contract
- Non-custodial escrow contract (single deployable factory, one contract instance per trade or shared)
- **Multi-signature model (2-of-3):** buyer key + seller key + platform (arbitrator) key
  - Normal release: buyer + seller agree (or seller confirms alone)
  - Dispute: platform arbitrator key decides
- **Time-lock fallback:** if no action within the window, funds auto-return to seller
- Supported token standards:
  - ERC-20 (Ethereum, Polygon, BSC)
  - TRC-20 (Tron)
  - SPL (Solana)
- Platform holds an **arbitrator key only** — used exclusively for dispute resolution, never for normal custody

### 4.3 Auto-Release Rules
- Buyer no-show -> auto-cancel, release to seller
- Seller no-show -> configurable (auto-release or hold for review)
- Risk-based: high-chargeback methods (PayPal, gift cards) get extended hold (24-48h)

---

## 5. Dispute Resolution (Appeals)

### 5.1 Dispute Reasons
- Payment not received / wrong amount / wrong reference
- Seller not responding after payment
- Chargeback / payment reversal after release
- Wrong account details / name mismatch
- Partial payment disputes

### 5.2 Evidence Submission
- Payment screenshots, bank statements, transaction IDs, screen recordings
- Chat logs auto-included
- 48-hour evidence window
- Both parties see each other's evidence

### 5.3 Admin Review & SLA
- Moderation queue with chat history, evidence, reputation data
- Can request additional evidence from either party
- Target resolution: 24-48 hours
- **Fast-track path** for verifiable cases (e.g., "payment sent but coins not released" with clear on-chain/bank evidence)

### 5.4 Resolution & Appeal
- Admin rules, escrow released to winner
- Loser's completion rate affected
- Fraud -> account ban
- **Appeal window:** user must file within 5 days of order closing (Bybit standard)
- Escalation to senior admin is final

---

## 6. Payment Methods & Fiat Currencies

### 6.1 Supported Fiat Currencies (multi-country)
Each supported currency has its own rate against USDT/USDC (from the price feed):

| Region | Currencies |
|--------|-----------|
| Africa | NGN (Nigeria), KES (Kenya), GHS (Ghana), ZAR (South Africa), UGX (Uganda) |
| Europe | EUR, GBP |
| Americas | USD, CAD |
| Asia | INR, PHP, VND, THB |
| Middle East | AED, SAR |

### 6.2 Payment Methods (per country/region)
**Bank Transfers:** Local bank transfer, SEPA, Wire, SWIFT
**Mobile Money:** MTN MoMo, M-Pesa, Airtel Money, OPay, PalmPay, GCash, Paytm
**Digital Wallets:** PayPal, Payeer, AdvCash
**Cash:** In-person (high risk, extended escrow)

> Note: Paxful supported 350+ methods at peak. Launch with the right 10-15 per target region, expand based on demand.

### 6.3 Management
- Users add/verify payment methods in settings
- Sellers select accepted methods per ad
- Buyers filter by payment method
- **Risk level per method** affects escrow rules and hold periods
- **Payment account binding:** users may bind a payment account to signal control of it (optional trust signal)

---

## 7. Chat System

### 7.1 In-Trade Chat
- Text + image sharing (payment proof screenshots)
- Pre-set quick messages ("Payment sent, please confirm")
- Chat preserved for dispute resolution (evidence)
- Encrypted in transit
- Available only during active trades

### 7.2 Notifications
- Real-time: trade events, messages, disputes
- In-app notification center
- Email notifications (configurable)
- Push notifications (future, mobile)

---

## 8. Reputation & Trust System

### 8.1 Core Metrics (displayed on every profile + ad)
- **Completion rate (30-day):** Completed / Total × 100%. This is THE primary trust signal. Below 90% = red flag.
- **Total trade count**
- **Average release time** (under 5 min = excellent)
- **Cumulative counterparties** (unique trading partners)
- **30-day trading volume** (USDT-equivalent)
- Account age (first trade date)
- Verified advertiser status
- Response time in chat
- Post-trade feedback

### 8.2 Trust Tiers (user-facing)
| Tier | Requirements | Benefits |
|------|-------------|----------|
| New | Just joined | Basic trading, low limits |
| Established | 10+ trades, >90% completion | Higher limits |
| Trusted | 50+ trades, >95% completion, verified | Priority search, highest limits |
| Advertiser | See Section 9 | Badge, lower fees, bulk tools |

### 8.3 Post-Trade Rating
- Positive / Neutral / Negative
- Optional text feedback
- **Anonymous and final** (no edits, no responses — prevents manipulation)
- Permanent, visible on profile
- Good-faith disputes not penalized

### 8.4 Anti-Gaming Measures
- **Wash trading detection:** flag trades between accounts sharing IP / device fingerprint / wallet
- **Feedback manipulation:** anonymous + final ratings
- **Account selling:** monitor device fingerprint / IP / trading pattern changes

---

## 9. Advertiser / Merchant System (Bybit-style two-tier)

This is the core liquidity model. Regular users trade, advertisers provide the liquidity backbone.

### 9.1 General Advertisers (3 levels)
Requirements and per-level limits:

| Requirement | Beginner | Regular | Veteran |
|-------------|----------|---------|---------|
| Phone + email binding | ✓ | ✓ | ✓ |
| Registration period | 7 days | 30 days | 30 days |
| Min completed orders | 5 | 20 | 50 |
| 30-day completion rate | 80% | 85% | 90% |
| Security deposit (USDT) | 200 | 200 | 200 |
| Cumulative counterparties | 1 | 5 | 5 |
| 30-day volume (USDT) | < 2,000 | 2,000 | 10,000 |

**Per-level ad limits:**
| Benefit | Beginner | Regular | Veteran |
|---------|----------|---------|---------|
| Max USDT/USDC per ad | 1,000 | 20,000 | 50,000 |
| Max BTC per ad | 0.05 | 1 | 2 |
| Max ETH per ad | 1 | 15 | 30 |
| Ad direction | Sell only | Buy & Sell | Buy & Sell |
| Max active pairs (same direction) | 1 | 2 | 3 |

### 9.2 Verified Advertisers (3 tiers)
- **Bronze / Silver / Gold** tiers with unique badges on avatar + profile
- Must be a general advertiser first
- Higher ad visibility and trust
- Dedicated / priority customer support (faster dispute handling)
- Exclusive promotions
- Upgraded/downgraded based on tier requirements (announced by platform)

### 9.3 Security Deposit
- Refundable USDT deposit held in Funding Account
- Returned when advertiser forfeits role in good standing
- Unlocked/lost on disqualification (risk control, completion rate < 90%)

### 9.4 Disqualification
- Unlink phone or email
- Unlink payment accounts
- Risk control interception
- 30-day completion rate below threshold
- Security deposit unlocked (for risk-flagged users)

### 9.5 Application Flow
- Apply via "Advertiser Privileges" page
- System checks eligibility against requirements automatically
- General: ~2 working days; Verified: up to 15 working days

### 9.6 Trial Advertiser Program
- For users who don't yet meet requirements
- Limited ad-posting access to bootstrap liquidity

---

## 10. Fee Structure & Revenue

### 10.1 Trading Fees (maker/taker)
- **Taker (buyer):** 0% at launch (Bybit/Paxful-style zero taker fee attracts buyers)
- **Maker (seller/advertiser):** 0-0.5% depending on pair + advertiser status
- **Merchant/Verified:** reduced fees or rebates
- Fees deducted from escrowed crypto at release

### 10.2 Spread Revenue
- P2P costs are driven by **spreads** (2.5-3.5% typical), not fees
- Platform earns from the reference price vs. market price gap
- Alternative to explicit fees; explicit low fees build more trust

### 10.3 Additional Revenue
- **Ad promotion / boosted listings** (sponsored ads to top of search)
- **Merchant subscriptions** ($50-200/month for verified tier)
- **Float income** — yield on aggregate escrow balance (staking/lending; note regulatory risk)
- **Analytics reports** (future)
- **Referral program** rewards (paid out as % of referred users' fees)

---

## 11. Search & Discovery

### 11.1 Filters
- Cryptocurrency, fiat currency, payment method
- Trade amount range
- Advertiser only / verified only toggles
- Online only toggle
- Price range for floating-price ads

### 11.2 Results
- Sorted by: best rate, completion rate, advertiser priority
- Shows: seller name, advertiser badge, completion rate, price, methods, limits, release time
- Real-time price updates

### 11.3 Ad Detail Page
- Full ad details, seller profile preview
- "Start Trade" with amount input
- Online status, active hours, trade instructions + payment reference

---

## 12. Admin Dashboard (P2P)

### 12.1 Trade Management
- View all active/past trades, filter by status/date/amount
- Dispute queue with release/cancel/ban actions

### 12.2 User Management
- Payment account binding review
- Advertiser application approval/rejection (both tiers)
- Account suspension/banning, risk-control interception
- User dispute history

### 12.3 Financial Dashboard
- Volume traded (24h, 7d, 30d, all-time)
- Fees collected, escrow balance, float
- Revenue breakdown by crypto/fiat

### 12.4 Fraud Monitoring
- Suspicious pattern detection, velocity checks
- New account abuse, geographic anomalies
- Chargeback pattern alerts
- Wash-trading detection (IP/device/wallet cross-reference)

---

## 13. Security

### 13.1 Account Security
- 2FA via TOTP, login alerts
- Anti-phishing code in all official emails
- Session management, withdrawal whitelisting

### 13.2 Platform Security
- Chat encryption, DDoS protection
- Rate limiting, input validation
- SQL injection / XSS / CSRF prevention

### 13.3 Escrow Security
- Hot/cold wallet split
- Multi-signature, regular balance audits
- Automated anomaly detection

### 13.4 P2P-Specific Fraud Prevention
- **Triangle scam:** warn sellers to verify the sender's payment account name against the buyer's bound payment account before releasing
- **Payment reversal:** hold periods for reversible methods; verify funds settled (not pending)
- **Account takeover:** device fingerprinting + velocity checks
- **Sybil / wash trading:** IP / device / wallet cross-referencing

---

## 14. Wallet & Crypto Management (Non-Custodial)

### 14.1 Wallet Connect
- Users connect their **own external wallet** — MetaMask, WalletConnect, Phantom, TronLink, etc.
- **No platform deposits** — crypto stays in the user's wallet until a trade
- **Seller** approves the escrow contract (token `approve`), crypto is debited via `transferFrom` on trade initiation
- **Buyer** receives crypto directly to their connected wallet address on release
- Wallet address recorded against the user profile for trade routing

### 14.2 Supported Assets & Chains
| Asset | Chains / Standards |
|-------|-------------------|
| USDT | ERC-20 (Ethereum, Polygon, BSC), TRC-20 (Tron), SPL (Solana) |
| USDC | ERC-20 (Ethereum, Polygon, BSC), SPL (Solana) |
| BTC, ETH, SOL | Native (expandable) |

### 14.3 On-Chain Transaction Flow
- Trade initiation → escrow contract pulls seller's tokens (`approve` + `transferFrom`)
- Release → escrow contract transfers tokens to buyer's address (`transfer`)
- Timeout/refund → escrow contract returns tokens to seller's address
- Every on-chain action logged with tx hash in the trade record

### 14.4 Platform Keys
- Platform holds only the **arbitrator key** (part of the 2-of-3 escrow multisig)
- Used exclusively for dispute resolution — never for normal custody
- Key secured via hardware wallet / HSM

---

## 15. Data & Analytics

### 15.1 User Analytics
- Personal trade history and statistics
- Connected wallet summary (addresses, on-chain activity)
- Earnings from trading (advertisers)

### 15.2 Platform Analytics (Admin)
- Trade volume trends
- User growth metrics
- Dispute rate trends
- Revenue and fee collection
- Most popular crypto/fiat pairs and payment methods
- On-chain settlement volume per chain

---

## 16. Tech Stack (Planned)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | Neon PostgreSQL |
| Auth | NextAuth.js (Google OAuth + email) |
| Styling | Tailwind CSS |
| Real-time | WebSockets (chat, notifications) |
| Price Feed | CoinGecko API (USDT/USDC rates per fiat currency) |
| Web3 Wallets | wagmi + viem (EVM), WalletConnect, TronWeb (Tron), Solana wallet adapter |
| Escrow Contracts | Solidity (EVM), TRC-20 contract (Tron), SPL program (Solana) |
| Icons | Lucide React |

---

## 17. Launch & Growth Strategy

### 17.1 Seed Liquidity (Weeks 1-4)
- Recruit 10-20 merchants/advertisers before public launch
- Offer 3-month fee waivers, priority badges
- Seed own ads if necessary (actually fulfill trades — don't fake volume)
- **Launch multi-currency from day one** — support USDT/USDC against major fiat currencies (NGN, USD, EUR, KES, GHS, etc.) so users in any supported country can trade

### 17.2 Build Trust (Months 2-3)
- Resolve every dispute fast (response time IS the brand)
- Publish clear policies (disputes, chargebacks, limits)
- Display social proof (completed trades, ratings)

### 17.3 Scale (Months 4-6)
- Expand payment methods based on merchant feedback per region
- Add more fiat currencies and trading pairs (USDT/USDC against each currency)
- Launch referral program (P2P traders are social — leverage it)

### 17.4 Optimize (Months 6-12)
- Automate common dispute patterns (80% follow the same patterns)
- Mobile-first (80%+ of P2P trades happen on mobile)
- Automated fraud detection
- Add more chains/networks for lower-fee settlement
