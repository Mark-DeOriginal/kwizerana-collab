# Internal Escrow Security Review — 2026-09-29

## Scope and status

This is a first-party engineering review of `contracts/KwizeranaEscrow.sol`, its local tests, deployment tooling, server receipt verification, and database reconciliation path. It is **not an independent audit** and is **not approval for mainnet or real-value trading**.

Reviewed revision: `52c384d` plus the working-tree changes described here. Compiler: Solidity `0.8.28`; EVM target: `cancun`; optimizer: 200 runs.

## Methods and evidence

- Manual review of authorization, lifecycle, cancellation, arbitration, fee, token-transfer, reentrancy, liability, and recovery paths.
- Solhint recommended static rules: no errors after excluding documentation-only and optional gas-style rules.
- Thirteen Hardhat scenarios, including the 0%–100% owner fee range, varied amount/fee property cases, and balance/liability invariants: all passing.
- TypeScript source validation: `npx tsc --noEmit` passed after isolating corrupt generated `.next` cache files.
- Fuji runtime bytecode and constructor configuration verified against the local artifact.

## Remediated finding

### KWI-ESC-01 — Buyer could mark payment after cancellation protection expired

**Severity:** High for availability/fairness. **Status:** Fixed and regression-tested.

After a seller requested cancellation, `markPaymentSent` remained callable after the 30-minute protection deadline until a refund transaction was mined. A buyer could therefore front-run a valid refund, permanently disable the timeout path, and force arbitration. The contract now rejects payment marking at or after `cancellationAvailableAt`. Marking before the deadline remains valid.

## Reconciliation improvement

Confirmed events are now written to the append-only, uniquely keyed `p2p_escrow_events` journal before application projections proceed. Repeated submissions are idempotent. Failed verification marks all affected trades—including previously terminal database rows—as `reconciliation_required`.

This is a material improvement, but it does not complete the production gate: wallet submission and server projection remain separate operations, automatic historical log backfill and reorg rollback are not complete, and runtime schema initialization must be replaced with versioned migrations.

## Residual risks and required gates

- Owner, arbitrator, and treasury are still one disposable Fuji EOA. Production requires separate reviewed multisigs and operating policies.
- Independent third-party audit is still required; a first-party author cannot provide independence.
- Fork tests against the exact production USDT/USDC implementations are still required.
- Reorg-safe event indexing, durable retry/backfill, RPC-failure drills, and complete end-to-end application evidence remain required.
- Stablecoin issuer freezes, proxy upgrades, blacklist controls, governance compromise, lost keys, chain failure, and legal/payment risk are outside the contract's guarantees.

## Testnet deployment

The patched immutable contract was deployed to Avalanche Fuji at `0x50a8559d42d52c3B85B1FEc00355B993070ad848` in transaction `0x48c378146045e6c996382ac1ac49c9aab2eb6e6c8a9344bea912350fd3e4e51a` (block `58855826`). It is for valueless test tokens only.
