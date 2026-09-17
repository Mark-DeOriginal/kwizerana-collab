# P2P Milestones and Current Status

Last reconciled with the repository: 2026-09-16. Status terms follow `AGENTS.md`. “Implemented” does not mean production-verified.

## Accounts and security

| Capability | Status | Evidence / remaining work |
|---|---|---|
| Email/password, Google, email verification | Implemented | P2P auth routes, NextAuth, signed verification |
| TOTP 2FA, backup codes, anti-phishing | Implemented | Recovery and high-risk enforcement remain |
| Session/device management | Planned | Add device list, revocation, alerts, recent-auth policy |
| Distributed rate limiting | Unsafe for production | Current limiter is per-process and narrowly applied |
| Wallet account linking | Partial | Connected addresses are saved without ownership proof; reassess this security tradeoff before production |

## Market, ads, pricing, and payments

| Capability | Status | Evidence / remaining work |
|---|---|---|
| Offer discovery, fiat/crypto data | Implemented | Market UI, offer and currency APIs |
| Admin-triggered rate refresh | Partial | Manual dashboard update is implemented; resilience/monitoring required |
| Payment methods and ad CRUD | Implemented | Account/dashboard/API support |
| Floating/vendor-margin pricing | Partial | Precision, snapshots, deviation controls needed |
| Payment-method binding | Partial | Ownership/applicability validation needs hardening |
| Inventory | Partial | Vendor-declared, not cryptographically verified |
| One-click matching | Planned | No verified implementation found |

## Vendors and reputation

| Capability | Status | Evidence / remaining work |
|---|---|---|
| Vendor profile, application, admin review | Implemented | Vendor/admin routes and UI |
| Tier eligibility/enforcement | Partial | Data/services exist; full policy enforcement needs verification |
| Vendor fee configuration | Implemented | Buy/sell fee fields and interfaces |
| Reviews and rating summaries | Implemented | The dashboard trade modal remains open after buyer claim so the completed-state vendor rating panel is shown; anti-gaming remains. |
| Completion statistics | Partial | Must derive from verified settlement and correct rolling windows |
| Fraud/wash-trade detection | Planned | No robust implementation found |

## Trade lifecycle

| Capability | Status | Evidence / remaining work |
|---|---|---|
| Trade creation and snapshot | Partial | Connected buyer wallets are captured during order creation; awaiting-approval orders have a server-validated receiving-wallet step; initiator/counterparty identity now controls cancel-versus-decline permissions independently of buyer/seller roles. Atomicity, precise math, and eligibility still need hardening. |
| Seller accept/fund | Partial/testnet | Buy orders let the advertising crypto seller review and fund escrow after the destination exists. Sell orders now require the fiat-paying vendor to accept and confirm liquidity before the initiating crypto seller can fund. The server enforces both sequences and checks the lock event; submitted/confirmed projection separation remains. |
| Buyer payment submission | Implemented | Buy and sell flows share the same enabled receipt action; authorization is enforced by the escrow transaction and verified server-side instead of a brittle client-side address gate. Secure upload controls remain required. |
| Seller release and buyer claim | Partial/unsafe | Hardened contract ABI and immediate receipt/event checks exist; submitted/confirmed states and testnet reconciliation still need completion |
| Cancel/expiry/refund | Partial/testnet | Replacement escrow requires an explicit seller cancellation request, preserves a 30-minute window for the buyer to mark payment, supports buyer-approved immediate cancellation, and permits refund only after the protection window. Application event persistence and full end-to-end testing remain. |
| Chat and trade export | Implemented | Retention/rate/abuse controls remain |
| Notifications/email | Partial | Dashboard completion activity now reaches both trade participants without duplicating the updated order row; durable delivery queue and telemetry still needed |
| Formal state machine | Documented target | Implementation migration pending |

## Escrow and chain integration

| Capability | Status | Evidence / remaining work |
|---|---|---|
| Avalanche wallet connection | Implemented | RainbowKit/wagmi |
| Prototype ERC-20 contract | Implemented prototype | Lock/release/claim/refund only |
| Production escrow | Implemented candidate, unsafe for production | Explicit cancellation recovery, buyer payment protection, fixed recipients, fee accounting, allowlist, liability protection, and governed arbitration pass nine local scenarios. The replacement is deployed on Fuji; independent audit and launch gates remain. |
| Receipt/event verification | Partial, P0 | Immediate receipt and expected-event verification exists for escrow mutations; durable confirmation/reorg processing remains required before real funds. |
| Confirmation/reorg policy | Planned, P0 | Required before real funds |
| Event reconciliation | Partial, P0 | Immediate verification, request-time checks, manual admin recheck, and an authenticated webhook route exist; provider delivery/retries and reorg handling remain |
| Contract tests/testnet/audit | Partial, P0 | Nine local security scenarios pass and the replacement deployment transaction is confirmed on Fuji; configuration reads, end-to-end trade evidence, fuzz/invariants, static analysis, fork tests, multisig governance, and independent audit remain. |

## Disputes

| Capability | Status | Evidence / remaining work |
|---|---|---|
| Participant and admin dispute flows | Implemented | Routes/services/UI exist |
| Evidence workspace | Partial | Secure uploads and structured evidence needed |
| On-chain resolution | Unsafe for production | Current resolution changes database only |
| Split resolution | Unsupported | Prototype contract cannot split funds |
| Appeals/SLA/escalation | Planned | Policy and workflow required |

## Dashboards and administration

| Capability | Status | Evidence / remaining work |
|---|---|---|
| Member/vendor dashboard | Implemented, needs redesign | Large multi-workflow page; see `../DASHBOARD-PLAN.md` |
| Admin dashboard | Implemented, needs redesign | Exception queues and auditability needed |
| Escrow reconciliation queue | Planned, P0 | Required before real-value operation |
| Immutable admin audit log | Planned, P0 | Required for financial/permission actions |
| Provider/event health | Planned | Surface RPC, rate, email, and webhook delivery failures |

## Platform quality

| Capability | Status | Evidence / remaining work |
|---|---|---|
| Shared visual identity | Partial | Existing palette; incomplete system and inconsistent pages |
| Responsive/accessibility | Partial | Core flows need keyboard, focus, screen-reader, zoom validation |
| Request performance | Partial | Trade-page duplicate startup requests and redundant dashboard SSE/poll loops are removed; polling pauses in hidden tabs, background offer refreshes do not replace visible content with loading UI, and schema readiness has a versioned fast path. Production request tracing and load testing remain. |
| Automated tests and CI | Planned | None found during audit |
| Versioned migrations | Planned | Runtime schema initialization currently used |
| Observability/runbooks | Planned | Required before production |
| Legal/privacy/risk readiness | Planned | Counsel and operating policies required |

## Immediate sequence

1. P0 trade integrity and chain verification.
2. Escrow v2 specification, tests, testnet, and audit.
3. Reconciliation, audit logging, durable rate limiting, and secure uploads.
4. Shared design system and dashboard restructuring.
5. End-to-end P2P UX and accessibility.
6. Operational and legal launch gates.
