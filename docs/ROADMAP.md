# Product and Engineering Roadmap

Statuses in this document are evidence-based. Detailed P2P status lives in `docs/p2p-marketplace/MILESTONES.md`.

## Release rule

No real-value P2P launch until P0 security, escrow, state-consistency, operational, and legal-readiness gates in `docs/PRODUCTION-READINESS.md` are satisfied.

## Phase 0: Documentation baseline

Status: **in progress**

- Establish `AGENTS.md`, `DESIGN.md`, architecture, dashboard, production-readiness, state-machine, and escrow-security documents.
- Reconcile old plans with code.
- Label functionality implemented, partial, simulated, unsafe, or planned.
- Keep this roadmap and milestones updated in every substantial change.

## Phase 1: P2P correctness and security

Status: **planned; highest priority**

- Freeze and enforce the trade state machine.
- Add schema-level constraints for states and financial invariants.
- Add transactional mutations, row locks, idempotency, and replay protection.
- Decide whether wallet ownership proof is required before launch. Connected addresses are currently linked without a signature challenge.
- Verify Avalanche receipts and escrow events server-side.
- Complete provider webhook delivery, retry handling, and on-demand reconciliation operations.
- Complete durable action idempotency across every trade mutation.
- Remove production escrow simulation.
- Harden authorization, validation, uploads, rate limiting, secrets, and audit logs.
  - Partial evidence: protected application pages are centrally session-gated in `middleware.ts`, with safe post-auth return paths through `/redirect`; API authorization remains route-local.
  - Rate integrity fix: runtime P2P seeding now inserts only missing currency pairs and preserves persisted admin/provider rates and their timestamps.
  - Performance baseline: trade/dashboard polling is visibility-aware, delayed until after initial content, and non-overlapping; duplicate mount fetches and the nested serverless SSE polling loop were removed. Database initialization now uses a persisted schema-version fast path after the first migration check.

Exit: database state cannot be advanced by a fabricated hash or invalid actor, and divergence is detected and recoverable.

## Phase 2: Escrow v2

Status: **implementation candidate; testnet validation and audit pending**

- Confirm trust and decentralization model.
- Implemented replacement candidate: explicit cancellation with a 30-minute buyer-protection window, permissionless recovery after that window, fixed settlement recipients, token controls, safe transfers, 0.20% successful-trade fee, multisig-ready roles, and new-lock pause without blocking exits. Automatic expiry no longer prevents a buyer from recording payment.
- Nine local scenarios pass, and the replacement is deployed on Avalanche Fuji; complete the recorded on-chain configuration check and end-to-end application drill, then add integration, fuzz, invariant, stablecoin-fork, and static-analysis coverage.
- Integrate verified contract events with the server.
- Deploy and exercise on Avalanche testnet.
- Obtain independent audit before mainnet.

Exit: audited contract and end-to-end testnet settlement with reconciliation.

## Phase 3: Product shell and design system

Status: **planned**

- Capture existing key screens and choose one of three grounded visual directions.
- Formalize tokens, typography, spacing, radius, elevation, state colors, and content style.
- Build shared navigation, dashboard shell, page headers, tables, filters, forms, dialogs, alerts, timelines, and state views.
- Add accessibility baseline and responsive rules.

Exit: reusable primitives support the key archive and P2P flows without one-off visual patterns.

## Phase 4: Member and trade experience

Status: **planned on top of partially implemented features**

- Refine market discovery and price transparency.
- Rebuild order entry and trade detail around authoritative state.
- Capture the buyer's Avalanche receiving wallet before vendor approval, allow it to be changed only while the order is still awaiting approval, and keep the funded escrow recipient immutable.
- Persist the Avalanche wallet connected from the dashboard as the user's primary default and hydrate awaiting-approval trades from that saved address.
- Keep requested trades visible until participant cancellation; never translate an escrow recovery deadline into an unverified off-chain terminal state.
- Keep cancelled or expired funded trades in Active Trades until the escrow refund is confirmed; clearly distinguish refund required from refund pending.
- Distinguish the request initiator from buyer/seller asset roles: initiators cancel their request, while receiving counterparties decline it.
- Treat a counterparty decline as a terminal unfunded transition for both participants, retain the stated reason, and remove all approval, funding, and proceed-anyway actions.
- Apply initiator permissions after funding as well, and keep receipt submission consistent across buy and sell trades while enforcing the escrow actor on-chain and server-side.
- Keep Buy and Sell acceptance semantics distinct: Buy vendors review and fund escrow, while Sell vendors first confirm fiat liquidity and only then may the initiating crypto seller fund escrow.
- Complete receipts, chat, notification, cancellation, refund, review, and dispute journeys.
- Preserve recipient-specific lifecycle activity for both participants without duplicate delivery of the same transition.
- Add member dashboard routes for orders, wallets, payment methods, security, and reputation.

Exit: realistic end-to-end buy and sell journeys pass happy-path and failure-path tests on testnet.

## Phase 5: Vendor operations

Status: **planned on top of partially implemented features**

- Split ads, inventory, pricing, orders, availability, analytics, and tier progress into focused routes.
- Replace declared inventory trust with clear verification/proof semantics.
- Enforce advertiser eligibility and risk rules.
- Add queue prioritization and operational alerts.

Exit: vendors can operate safely without relying on hidden admin intervention.

## Phase 6: Admin operations

Status: **planned on top of partially implemented features**

- Build trade monitoring and escrow reconciliation queues.
- Create a complete dispute evidence and resolution workspace.
- Consolidate role/permission checks.
- Add immutable audit logs, rate/provider health, job status, and configuration warnings.
- Retain influencer submission and ranking administration as a distinct module.

Exit: exceptions can be identified, assigned, resolved, and audited.

## Phase 7: Influencer archive refinement

Status: **implemented foundation; refinement planned**

- Improve information architecture, filter/search clarity, comparison, freshness, provenance, and profile detail.
- Improve submission/review states and provider failure handling.
- Align metadata and navigation with the broader Kwizerana platform.

## Phase 8: Launch readiness

Status: **planned**

- Automated tests and CI gates.
- Versioned database migrations and rollback plans.
- Observability, alerting, backups, restoration drills, runbooks, and incident response.
- Performance, accessibility, privacy, abuse, and security testing.
- Legal/regulatory review for supported jurisdictions and payment methods.
- Controlled beta with limits and testnet-to-mainnet rollout gates.
