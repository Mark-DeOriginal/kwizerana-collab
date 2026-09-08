# Production Readiness

This is a launch gate, not a claim that the application is ready. P0 items block real-value P2P trading.

## P0: Financial correctness

- [ ] Production cannot run simulated escrow.
- [ ] Every escrow state transition is derived from a confirmed contract event.
- [ ] Chain ID, contract, event, trade ID, actor, token, amount, and recipient are verified.
- [ ] Required confirmation depth and reorg handling are defined.
- [ ] Trade mutations are atomic, idempotent, replay-safe, and row-locked.
- [ ] Concurrent actions cannot double-complete, double-refund, or overwrite a terminal state.
- [ ] Prices, margins, fees, and decimals use precise decimal/integer arithmetic.
- [ ] Payment methods are proven to be valid and owned by the applicable party.
- [ ] Escrow/database reconciliation runs continuously and produces an operator queue.
- [ ] Funded expired trades have a safe on-chain recovery path.
- [ ] Dispute decisions execute and verify the corresponding on-chain outcome.

## P0: Contract safety

- [ ] Trust model and meaning of “decentralized” are approved and published accurately.
- [ ] Escrow v2 requirements in `p2p-marketplace/ESCROW-SECURITY.md` are implemented.
- [ ] Unit, integration, fuzz, and invariant tests pass.
- [ ] Deployment bytecode and source are verified publicly.
- [ ] Admin/arbitrator control uses approved governance, preferably a multisig with operational controls.
- [ ] Independent smart-contract audit findings are resolved or explicitly accepted.
- [ ] Testnet incident and recovery exercises are complete.

## P0: Application security

- [ ] Central authorization policies replace inconsistent route-level checks.
- [ ] Development admin bypasses are impossible in production and covered by tests.
- [ ] Durable distributed rate limiting protects auth, wallet, trade, chat, upload, and admin endpoints.
- [ ] CSRF/session behavior is reviewed for every mutation mechanism.
- [ ] Wallet ownership uses signed, expiring, single-use challenges.
- [ ] File uploads use size/type limits, object storage, malware scanning, signed access, and retention rules.
- [ ] Sensitive payment information is encrypted or minimized and access is audited.
- [ ] Secrets have rotation procedures; private keys are never application environment variables in production.
- [ ] Security headers, CSP, dependency scanning, and vulnerability response are configured.
- [ ] Logs redact authentication, wallet, receipt, and payment secrets.

## P0: Identity and recovery

- [ ] Email verification and password reset flows are complete.
- [ ] TOTP setup, disablement, recovery, and backup-code behavior are tested.
- [ ] Session/device visibility and revocation exist.
- [ ] Account takeover and wallet-change protections exist for active trades.
- [ ] High-risk actions require recent authentication and/or 2FA.

## P0: Operations and compliance

- [ ] Supported countries, currencies, payment methods, and restrictions pass legal/regulatory review.
- [ ] Terms, privacy policy, risk disclosures, dispute policy, fee schedule, and prohibited activity policy exist.
- [ ] Sanctions, fraud, abuse, and lawful-request procedures are defined as required by counsel.
- [ ] Dispute ownership, SLA, escalation, and arbitrator-key procedures have named operators.
- [ ] Backups, point-in-time recovery, restoration tests, and retention are configured.
- [ ] Metrics, traces, structured logs, alerts, and incident response exist.
- [ ] Cron/worker authentication fails closed when secrets are absent in production.

## P1: Reliability and maintainability

- [ ] Runtime schema creation is replaced with versioned migrations.
- [ ] Database connection, provider, and RPC timeouts/retries are intentional and observable.
- [ ] Email and notification delivery uses a durable queue.
- [ ] Tests cover domain logic, route authorization, database integration, and end-to-end flows.
- [ ] CI runs formatting, lint, types, tests, contract analysis, and production build.
- [ ] Staging matches production configuration without using production data.
- [ ] Feature flags and rollback procedures exist for high-risk functionality.

## P1: UX and accessibility

- [ ] All trade states have clear actor, next action, timer, amount, network, and escrow truth.
- [ ] Loading, empty, error, stale, offline, expired, pending-chain, and reconciliation-failure states exist.
- [ ] Mobile trade flows work with the software keyboard and narrow viewports.
- [ ] Keyboard, focus, screen-reader, contrast, zoom, and reduced-motion testing is complete.
- [ ] Irreversible actions use review/confirmation screens and plain-language warnings.
- [ ] No UI claims a transaction is complete before verified confirmation.

## Current known blockers

- Client-provided hashes are trusted.
- Escrow simulation can advance application state.
- The contract lacks documented multisig and timeout behavior.
- Dispute database resolution is not coupled to on-chain settlement.
- Financial operations lack comprehensive database transactions/locking.
- Rate limiting is in-memory and narrow.
- Runtime schema initialization replaces migrations.
- No repository test suite or CI configuration was found during the September 2026 audit.
