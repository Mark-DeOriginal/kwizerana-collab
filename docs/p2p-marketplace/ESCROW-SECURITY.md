# Escrow Security and Decentralization

## Current status

`contracts/KwizeranaEscrow.sol` is a prototype and must not hold real user funds without replacement or substantial hardening, automated tests, testnet exercises, and independent review.

The current contract supports:

- seller `lock()` using ERC-20 `transferFrom`;
- seller or arbitrator `release()`;
- buyer `claim()` to a chosen destination after release;
- seller or arbitrator `refund()` before release.

The frontend targets Avalanche C-Chain and native USDT/USDC addresses. When no contract address is configured, the UI simulates hashes and transitions for demonstration.

## Accurate trust description

The current design is non-custodial during normal account use, but escrow temporarily holds tokens. It is not trustless and it is not the documented 2-of-3 multisignature design. A single arbitrator address has unilateral authority to release or refund within the contract rules.

Production copy must state the actual control model. “Decentralized” should mean self-custody plus contract-enforced settlement with transparent, narrowly governed arbitration—not an absence of trusted roles.

## Current contract gaps

- No on-chain deadline or permissionless timeout recovery.
- No 2-of-3 signature scheme.
- Immutable single arbitrator with no safe rotation/governance process.
- No pause/emergency policy.
- No token allowlist or explicit supported-token registry.
- No validation for zero buyer/token addresses or zero amount.
- Raw ERC-20 calls rather than hardened safe-transfer wrappers.
- No handling policy for fee-on-transfer, rebasing, callback-capable, paused, or non-standard tokens.
- Trade references rely on application uniqueness without domain separation.
- Buyer may claim to any address; this is flexible but increases phishing/loss risk.
- No partial settlement despite documentation mentioning split resolutions.
- No contract tests, fuzz tests, invariant tests, static-analysis configuration, or verified audit artifacts in the repository.
- No event-indexing and server-side reconciliation.

## Threat model

Protect against:

- fabricated or replayed transaction hashes;
- wrong-chain or wrong-contract transactions;
- token/decimal/amount mismatch;
- compromised seller, buyer, arbitrator, deployer, frontend, RPC, or application account;
- database/chain divergence and chain reorganization;
- front-running and duplicate trade identifiers;
- stuck funds after expiry, lost keys, or unavailable counterparty;
- malicious/non-standard tokens;
- phishing destination replacement;
- administrator misuse and unaudited dispute outcomes;
- upgrade or governance compromise if upgradeability is introduced.

## Escrow v2 requirements

### Settlement

- Immutable trade terms or a cryptographic commitment to them.
- Approved stablecoin registry and exact balance accounting.
- Explicit fund, release, refund, and resolved outcomes.
- On-chain deadlines and deterministic recovery.
- Exactly one terminal outcome.
- Events containing enough information for independent reconstruction.
- Clear handling of buyer destination: fixed at lock, explicitly changed by signed authorization, or intentionally flexible with strong warnings.

### Arbitration and governance

Choose and document one model before implementation:

1. Seller release plus arbitrator resolution, with arbitrator controlled by a multisig.
2. EIP-712 participant signatures with arbitrator fallback.
3. A true threshold/multisignature resolution model.

The governance address should be a multisig with signer policy, key rotation, incident process, and public visibility. Arbitrator powers must be minimal and evented.

### Engineering controls

- Use established, pinned, audited libraries such as OpenZeppelin where applicable.
- Apply checks-effects-interactions and reentrancy protection where relevant.
- Validate addresses, amount, token, deadline, unique trade ID, and participant roles.
- Avoid upgradeability unless its benefits clearly exceed governance risk.
- Document Avalanche token variants and reject unsupported assets.
- Verify source and deployment parameters on the block explorer.

## Required tests

- Happy path: approve, lock, release, claim.
- Refund before and after deadline according to policy.
- Dispute outcomes for buyer and seller.
- Unauthorized actor for every function.
- Duplicate trade ID and replay attempts.
- Zero/invalid address and amount inputs.
- Wrong token, decimals, and balance behavior.
- Double release/claim/refund.
- Reentrancy and malicious-token behavior.
- Invariants: escrow liabilities equal held balances; a trade has at most one terminal outcome; no unauthorized party can redirect value.
- End-to-end test connecting wallet, RPC, contract event, verifier, database projection, and UI.

## Deployment gates

1. Approve written trust model and specification.
2. Implement and test escrow v2 locally.
3. Run static analysis, fuzzing, and invariant tests.
4. Deploy to Avalanche testnet with multisig governance.
5. Exercise normal, timeout, dispute, RPC failure, reorg, and recovery paths.
6. Complete independent audit and remediate findings.
7. Verify mainnet source and configuration.
8. Launch with conservative token/amount limits and monitored reconciliation.

## Application integration requirements

- Never treat wallet `writeContract` resolution as final settlement.
- Never accept a transaction hash as proof without receipt/event validation.
- Represent submitted, confirmed, and reconciled states separately.
- Store canonical chain facts and make reconciliation idempotent.
- Disable demo settlement in production at configuration validation time.
- Display contract, network, asset, amount, destination, confirmations, and explorer proof.

