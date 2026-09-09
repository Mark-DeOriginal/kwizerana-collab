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

Exit: database state cannot be advanced by a fabricated hash or invalid actor, and divergence is detected and recoverable.

## Phase 2: Escrow v2

Status: **planned; current contract is prototype only**

- Confirm trust and decentralization model.
- Implement deadlines, refunds, token controls, safe transfers, governance, and emergency policy.
- Add unit, integration, fuzz, and invariant tests.
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
- Complete receipts, chat, notification, cancellation, refund, review, and dispute journeys.
- Preserve a single clear completion activity entry for both participants when a trade settles.
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
