# Escrow Security and Decentralization

## Current status

`contracts/KwizeranaEscrow.sol` is a hardened, non-upgradeable escrow candidate with a local automated test suite. It is ready for controlled Avalanche Fuji testing with valueless test tokens. It is **not approved for mainnet or real user funds** until independent review, verified testnet deployment, application event-reconciliation exercises, and the remaining P0 production gates are complete.

## Trust model

The seller deposits crypto into the contract. The buyer never deposits fiat on-chain. The design is self-custodial outside an active trade, but it is not trustless:

- only the recorded seller can confirm fiat receipt;
- after confirmation, anyone can finalize, but funds can go only to the buyer fixed at funding;
- a funded trade has no automatic expiry; the seller must request cancellation on-chain;
- a cancellation has a 30-minute buyer-protection window, during which the buyer can mark payment and permanently block a unilateral refund;
- the arbitrator can resolve a funded dispute only to the recorded buyer or seller;
- the owner configures future tokens, fees, and operational roles, but cannot withdraw active liabilities.

For testnet, owner and arbitrator may be clearly identified test wallets. Before mainnet, they must be separate multisig wallets with documented signer, rotation, compromise, and incident policies. This is contract-enforced escrow with governed arbitration, not fully decentralized or governance-free settlement.

## Fee model

- Initial testnet fee: **20 basis points (0.20%)**.
- Permanent contract cap: **100 basis points (1%)**.
- The seller deposits the advertised crypto amount plus the fee.
- The buyer receives the exact advertised crypto amount.
- The fee accrues separately in the contract only when the buyer is paid.
- Only the multisig owner can withdraw accrued fees, and withdrawal always pays the configured treasury.
- Timeout or seller-favoring arbitration refunds both principal and fee to the seller.
- Fee amount is calculated and stored when the trade is funded.
- `expectedFeeBps` makes funding revert if governance changes the rate between the wallet preview and transaction mining.

The application must disclose the exact token fee before the seller approves the deposit. Database pricing fees must not silently duplicate this on-chain fee.

## Stuck-fund controls

Every funded status has an on-chain exit:

| Contract status | Exit |
|---|---|
| `Funded`, no cancellation | Buyer marks payment, or seller requests cancellation |
| `Funded`, cancellation pending | Buyer marks payment, buyer approves an immediate refund, or anyone refunds after the 30-minute protection window |
| `PaymentMarked` | Seller release or arbitrator decision; timeout refund is disabled |
| `Released` | Permissionless claim to recorded buyer |
| `Claimed` / `Refunded` | Terminal; cannot settle twice |

Pausing affects new deposits only; it never disables an existing exit. The owner can recover only token balances above recorded liabilities and accrued fees. Transfers use OpenZeppelin `SafeERC20`, reentrancy protection, checks-effects-interactions, and exact incoming-balance validation. Fee-on-transfer deposits are rejected.

These controls materially reduce stuck-fund risk; they do not constitute a guarantee. Token-level freezes/blacklists, chain failure, governance compromise, implementation defects, and user loss of both participant and multisig keys remain external risks.

## Token policy

- Only explicitly allowlisted contracts can be funded.
- Mainnet native USDC and USDT addresses must never be reused on Fuji.
- Testnet must use separately configured test-token addresses.
- Rebasing, transfer-tax, callback-dependent, unreviewed bridged, or unusual proxy tokens must not be allowlisted.
- Before mainnet, verify token address, decimals, proxy implementation, blacklist/pause controls, and issuer documentation independently.

## Governance controls

- Non-upgradeable deployment: rules cannot be silently replaced behind a proxy.
- Two-step ownership transfer prevents accidental handoff.
- Owner can pause only new locks.
- Owner cannot redirect individual trades or withdraw escrow liabilities.
- Fee withdrawals are limited to the separately accounted accrued balance and always go to the configured treasury.
- Arbitrator cannot pay itself or an arbitrary destination.
- Token, fee, arbitrator, pause, ownership, and surplus-recovery changes emit events.

## Verified local tests

Run `npm run contract:test`. The current suite covers:

- fund, on-chain payment marking, seller release, permissionless finalization, exact buyer payment, 0.20% fee accrual, and protected withdrawal;
- unauthorized release/arbitration and double-settlement attempts;
- explicit cancellation, early-refund rejection, buyer-approved cancellation, and permissionless refund after the protection window;
- buyer- and seller-favoring arbitration;
- duplicate IDs, bad participants, and stale fee quotes;
- unapproved and fee-on-transfer token rejection;
- new-lock pause while existing settlement remains available;
- surplus recovery without withdrawing active liabilities.

Still required before mainnet: property/invariant fuzzing, static analysis, fork tests against exact supported stablecoin implementations, RPC/reorg tests, full application-to-chain reconciliation tests, and an independent audit.

## Application invariants

- A browser transaction hash is never settlement proof by itself.
- Server verification must match chain ID, contract, sender policy, trade ID, participant, token, amount, event, receipt success, and confirmation depth.
- The database must represent submitted, confirmed, and reconciled states separately before mainnet.
- Contract fee amount and cancellation events must be persisted from confirmed events.
- Demo settlement must remain unavailable in production.
- UI must show network, contract, token, principal, fee, cancellation state, destination, confirmations, and explorer evidence.

## Mainnet gates

1. Complete Fuji deployment and verify source/constructor arguments.
2. Execute success, timeout, both dispute outcomes, RPC interruption, and reconciliation drills.
3. Add fuzz/invariant, static-analysis, and stablecoin-fork coverage.
4. Make database transitions transactional and event-derived.
5. Put owner and arbitrator behind separate reviewed multisigs.
6. Obtain and remediate an independent smart-contract audit.
7. Complete legal, privacy, sanctions/AML, payment-risk, and incident-response review.
8. Launch with token allowlist, conservative limits, monitoring, and an emergency operating runbook.
