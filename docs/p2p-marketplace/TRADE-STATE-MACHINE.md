# P2P Trade State Machine

## Purpose

This document defines the target authoritative lifecycle. Current code approximates parts of it but does not yet enforce all rules transactionally or verify chain events. Until that work is complete, treat P2P as a prototype.

## Actors

- **Buyer:** pays fiat and ultimately receives crypto.
- **Seller:** funds crypto escrow and confirms fiat receipt.
- **Arbitrator:** resolves exceptional disputes under the published trust model.
- **Chain verifier:** confirms contract events and required block depth.
- **Event processor:** handles provider webhooks, reconciliation, notifications, and retryable work.

An administrator is not automatically the buyer or seller. Administrative database permission does not grant an on-chain capability unless the contract explicitly grants it.

## Proposed states

| State | Meaning | Required next actor |
|---|---|---|
| `requested` | Order terms are snapshotted; no funds locked | Seller accepts/funds or declines |
| `accepted` | A Sell-order vendor confirmed fiat liquidity; the initiating crypto seller has not funded yet | Seller funds or initiator cancels |
| `funding_submitted` | Seller transaction is known but unconfirmed | Chain verifier |
| `escrow_funded` | Valid `Locked` event has sufficient confirmations | Buyer pays fiat |
| `payment_marked_sent` | Buyer asserts fiat sent and provides reference/evidence | Seller verifies fiat |
| `release_submitted` | Seller/arbitrator release transaction is unconfirmed | Chain verifier |
| `released` | Valid release event confirmed; buyer may claim | Buyer |
| `claim_submitted` | Buyer claim transaction is unconfirmed | Chain verifier |
| `completed` | Valid claim/settlement event confirmed and reconciled | None/review |
| `cancelled_unfunded` | Request ended before funding | None |
| `declined_unfunded` | Receiving counterparty rejected the request before funding | None |
| `cancellation_pending` | Seller requested cancellation; buyer protection window is active | Buyer or chain clock |
| `refund_required` | Cancellation protection elapsed without payment being marked | Anyone through the contract |
| `refund_submitted` | Refund transaction is unconfirmed | Chain verifier |
| `refunded` | Valid refund event confirmed and reconciled | None |
| `disputed` | Normal settlement is frozen pending decision | Arbitrator |
| `expired_unfunded` | Request expired before valid funding | None |
| `reconciliation_required` | Chain and database facts disagree | Operations |

Names may be adjusted in a migration, but submitted, confirmed, and reconciled states must not be collapsed into one browser callback.

## Allowed transitions

```text
requested
  -> funding_submitted -> escrow_funded (Buy order: advertising crypto seller funds)
  -> accepted -> funding_submitted -> escrow_funded (Sell order: fiat-paying vendor accepts first)
  -> declined_unfunded
  -> cancelled_unfunded
  -> expired_unfunded

escrow_funded
  -> payment_marked_sent
  -> cancellation_pending -> refund_required
  -> disputed

payment_marked_sent
  -> release_submitted -> released
  -> disputed

released
  -> claim_submitted -> completed
  -> disputed (only if contract and policy still permit intervention)

disputed
  -> release_submitted -> released -> claim_submitted -> completed
  -> refund_submitted -> refunded
  -> reconciliation_required

refund_required
  -> refund_submitted -> refunded

any nonterminal chain-backed state
  -> reconciliation_required when verified facts conflict
```

Terminal states are `completed`, `refunded`, `declined_unfunded`, `cancelled_unfunded`, and `expired_unfunded`. Only the customer who initiated an order may rate the advertisement owner; vendors do not rate ordinary customers. A Buy-order customer may review after `completed`. A Sell-order customer may review after the vendor payment is confirmed and escrow is released, because that is the crypto seller's completed user journey even if the fiat-paying vendor has not claimed the crypto yet. Reviews cannot reopen settlement.

## Transition invariants

- A user cannot trade with the same effective account/vendor identity.
- Asset, chain, token, participants, decimals, price, fiat amount, fees, payment method, and contract address are immutable snapshots after request creation.
- `escrow_funded` requires a confirmed `Locked` event matching the snapshot.
- `payment_marked_sent` requires funded escrow.
- `released` requires a confirmed release event; a client callback is insufficient.
- After payment is marked sent, the seller may release as soon as the full fiat payment is verified in their account; the application does not impose a payment-method timer.
- `completed` requires a confirmed claim/transfer outcome to the authorized buyer destination.
- `refunded` requires a confirmed refund to the snapshotted seller.
- Exactly one terminal financial outcome is possible.
- Every transition records actor, source, timestamp, request/idempotency key, prior state, new state, and relevant chain facts.
- Notifications and emails are effects of a committed transition and must be safely retryable.

## Authorization

| Transition | Authorized initiator |
|---|---|
| Request | Authenticated eligible taker |
| Accept Sell request | Fiat-paying advertisement owner, after choosing a receiving wallet |
| Fund | Snapshotted crypto seller wallet/account; a Sell initiator may fund only after vendor acceptance |
| Mark fiat sent | Snapshotted buyer account |
| Release | Seller wallet or permitted arbitrator path |
| Claim | Snapshotted buyer wallet, subject to destination policy |
| Cancel before funding | Policy-defined buyer/seller/system |
| Request cancellation | Snapshotted seller wallet while payment is unmarked |
| Refund | Buyer approval or permissionless finalization after the contract protection window |
| Open dispute | Buyer or seller while policy permits |
| Resolve dispute | Authorized arbitrator governance |

Owned/managed vendor accounts require explicit delegation records and audit events. Do not infer financial authority only from a database ownership column.

For requested trades, the participant who selected an existing advertisement is the initiator and may cancel their request. The advertisement owner is the receiving counterparty and may decline it. Buyer/seller asset roles must not be used as a substitute for initiator/counterparty roles.

## Transaction verification

For every submitted hash verify:

- Avalanche chain ID and approved RPC source;
- successful receipt and required confirmation count;
- expected escrow contract address and deployed code;
- exact event signature and unique trade identifier;
- transaction sender/authorized actor;
- approved token address and decimals;
- exact amount and intended buyer/seller;
- no previously consumed transaction/event;
- event ordering and canonical block status.

Store transaction hash, block hash/number, log index, confirmations, event payload, verifier version, and verification timestamp.

## Concurrency and persistence

- Lock the trade row before evaluating a mutation.
- Compare-and-set the expected prior state.
- Use a single database transaction for trade state, escrow projection, audit event, and outbox record.
- Use unique constraints for chain event identity and idempotency keys.
- Deliver notifications from an outbox after commit.
- Re-running a valid request returns the existing result; it does not repeat effects.

## Cancellation and recovery

Off-chain jobs can mark intent or surface work, but cannot recover funds by changing a database field. A funded trade does not expire automatically. The seller must request cancellation on-chain. For 30 minutes the buyer may still mark payment, which permanently blocks cancellation and requires release or arbitration. If payment remains unmarked, the buyer may approve an immediate cancellation or anyone may finalize the refund after the protection window. The UI must distinguish “cancellation requested” from “refunded”.

Product decision (2026-09-16): a requested or funded trade is not automatically removed from Active Trades on a timer. It remains active until a participant explicitly cancels it or a verified on-chain terminal outcome is reconciled. Once the buyer marks payment, cancellation is unavailable and the parties must release or dispute the trade.

If the application trade is cancelled while escrow is still funded, the fiat buyer must not be shown seller refund controls. If the buyer already sent fiat, the buyer can upload a receipt and mark payment on-chain during the contract protection window. That transition blocks the refund, records the receipt, and immediately opens a dispute for administrator review. The seller may receive a refund only when no protected payment claim exists or when arbitration resolves the dispute to the seller.

If the fiat buyer did not send payment, the buyer may explicitly close the cancelled trade after a confirmation countdown. This is an off-chain acknowledgement and requires no wallet action; it removes the trade from that buyer's active queue while the seller's escrow refund remains governed by the contract protection period. A payment dispute remains available only before the buyer closes the trade.

## Disputes

Opening a dispute freezes normal application actions where the contract permits. Resolution must create an auditable decision and initiate the matching contract action. A dispute is not financially resolved until the resulting event is confirmed and reconciled.

For the currently deployed contract, buyer-favoring arbitration calls `resolveToBuyer` and atomically transfers the principal to the recorded buyer; seller-favoring arbitration calls `resolveToSeller` and atomically refunds principal plus fee to the recorded seller. These are terminal outcomes, not a separate participant claim step. The application records the escrow contract used when funding and must verify the matching `Claimed` or `Refunded` event before changing the dispute/trade to a terminal state or sending a resolution notification. A missing or mismatched contract configuration must stop resolution rather than enable simulation for a chain-backed trade.

Both participants can see an open dispute in the dashboard and dispute center. While it remains open, each side can submit factual notes and compressed receipt/screenshot evidence; the counterparty is notified when new evidence is added, and administrators can review the buyer and seller evidence separately. The current JSONB/image-data implementation is suitable for test workflows only. Production requires private object storage, signed access, malware scanning, retention limits, immutable evidence events, and an administrator audit trail.

The current `split` concept is unsupported by the prototype contract and must not be exposed until a contract supports precise partial settlement.

## Current implementation mapping

The current code uses `created`, `approved`, `escrow_locked`, `payment_sent`, `released`, `completed`, `declined`, `cancelled`, `expired`, and `disputed`. A counterparty decline transitions an unfunded `created` trade to terminal `declined` for both participants; it cannot subsequently be approved or funded. `approved` is used only for Sell orders: the fiat-paying vendor has accepted, and the initiating crypto seller may then fund escrow. Buy orders continue directly from `created` to `escrow_locked` when the advertising crypto seller funds. Browser-submitted and chain-confirmed states are still collapsed in places; migration to the full target model must preserve historical records and label unverifiable/demo hashes explicitly.
