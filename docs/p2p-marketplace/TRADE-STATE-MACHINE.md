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
| `funding_submitted` | Seller transaction is known but unconfirmed | Chain verifier |
| `escrow_funded` | Valid `Locked` event has sufficient confirmations | Buyer pays fiat |
| `payment_marked_sent` | Buyer asserts fiat sent and provides reference/evidence | Seller verifies fiat |
| `release_submitted` | Seller/arbitrator release transaction is unconfirmed | Chain verifier |
| `released` | Valid release event confirmed; buyer may claim | Buyer |
| `claim_submitted` | Buyer claim transaction is unconfirmed | Chain verifier |
| `completed` | Valid claim/settlement event confirmed and reconciled | None/review |
| `cancelled_unfunded` | Request ended before funding | None |
| `refund_required` | Funded order ended and must be refunded | Seller/arbitrator/timeout path |
| `refund_submitted` | Refund transaction is unconfirmed | Chain verifier |
| `refunded` | Valid refund event confirmed and reconciled | None |
| `disputed` | Normal settlement is frozen pending decision | Arbitrator |
| `expired_unfunded` | Request expired before valid funding | None |
| `reconciliation_required` | Chain and database facts disagree | Operations |

Names may be adjusted in a migration, but submitted, confirmed, and reconciled states must not be collapsed into one browser callback.

## Allowed transitions

```text
requested
  -> funding_submitted -> escrow_funded
  -> cancelled_unfunded
  -> expired_unfunded

escrow_funded
  -> payment_marked_sent
  -> refund_required
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

Terminal states are `completed`, `refunded`, `cancelled_unfunded`, and `expired_unfunded`. Reviews may follow completion but cannot reopen settlement.

## Transition invariants

- A user cannot trade with the same effective account/vendor identity.
- Asset, chain, token, participants, decimals, price, fiat amount, fees, payment method, deadlines, and contract address are immutable snapshots after request creation.
- `escrow_funded` requires a confirmed `Locked` event matching the snapshot.
- `payment_marked_sent` requires funded escrow.
- `released` requires a confirmed release event; a client callback is insufficient.
- `completed` requires a confirmed claim/transfer outcome to the authorized buyer destination.
- `refunded` requires a confirmed refund to the snapshotted seller.
- Exactly one terminal financial outcome is possible.
- Every transition records actor, source, timestamp, request/idempotency key, prior state, new state, and relevant chain facts.
- Notifications and emails are effects of a committed transition and must be safely retryable.

## Authorization

| Transition | Authorized initiator |
|---|---|
| Request | Authenticated eligible taker |
| Accept/fund | Snapshotted seller wallet/account |
| Mark fiat sent | Snapshotted buyer account |
| Release | Seller wallet or permitted arbitrator path |
| Claim | Snapshotted buyer wallet, subject to destination policy |
| Cancel before funding | Policy-defined buyer/seller/system |
| Refund | Contract-authorized seller/arbitrator/timeout path |
| Open dispute | Buyer or seller while policy permits |
| Resolve dispute | Authorized arbitrator governance |

Owned/managed vendor accounts require explicit delegation records and audit events. Do not infer financial authority only from a database ownership column.

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

## Expiry

Off-chain jobs can mark intent or surface work, but cannot recover funds by changing a database field. Funded expiry must use a contract-enforced deadline or an authorized on-chain refund. The UI must distinguish “expired; refund required” from “refunded”.

## Disputes

Opening a dispute freezes normal application actions where the contract permits. Resolution must create an auditable decision and initiate the matching contract action. A dispute is not financially resolved until the resulting event is confirmed and reconciled.

The current `split` concept is unsupported by the prototype contract and must not be exposed until a contract supports precise partial settlement.

## Current implementation mapping

The current code uses `created`, `escrow_locked`, `payment_sent`, `released`, `completed`, `cancelled`, `expired`, and `disputed`. It often moves directly to those states after a browser action and client-provided hash. Migration to the target model must preserve historical records and label unverifiable/demo hashes explicitly.
