# Dashboard Product Plan

## Goal

Create a role-aware operational workspace that tells each user what needs attention, what is happening with their funds or work, and what they can safely do next.

## Shared shell

- Collapsible desktop sidebar and compact mobile navigation.
- Role-aware destinations; member, vendor, and admin complexity remain separated.
- Consistent page headers, contextual actions, notification access, search, filters, tables, status timelines, and empty/error states.
- A global action-required count based on authoritative server data.
- No custodial “balance” language for connected self-custody wallets.

## Proposed routes

```text
/dashboard
/dashboard/orders
/dashboard/orders/[id]
/dashboard/wallets
/dashboard/payment-methods
/dashboard/security
/dashboard/reputation
/dashboard/vendor
/dashboard/vendor/orders
/dashboard/vendor/ads
/dashboard/vendor/inventory
/dashboard/vendor/analytics
/dashboard/disputes
/admin
/admin/trades
/admin/disputes
/admin/vendors
/admin/users
/admin/influencers
/admin/rates
/admin/system
/admin/audit-log
```

Route names may be adjusted during implementation, but domain separation should remain.

## Member dashboard

Priority order:

1. Actions requiring the member: fund, pay, confirm, claim, respond, or secure account.
2. Active orders with state, timer, counterparty, asset, fiat amount, and next actor.
3. Recent orders and receipts.
4. Connected wallets and network health.
5. Payment methods.
6. Reputation, reviews, favorites, referrals, and account security.

Primary actions: Buy crypto and Sell crypto.

## Vendor dashboard

Priority order:

1. Order queue sorted by urgency and expiry.
2. Escrow funding, payment confirmation, dispute, and refund actions.
3. Availability and ad pause controls.
4. Inventory per token, clearly labeled declared versus on-chain verified.
5. Rates, vendor margins, limits, and payment methods.
6. Completion rate, release time, dispute rate, volume, and ad conversion.
7. Tier progress and application state.

Charts are used only for trends that guide pricing, liquidity, service level, or risk decisions.

## Admin dashboard

Priority order:

1. Escrow/database mismatches and failed chain verification.
2. Open and aging disputes.
3. Stalled, expired, high-value, or suspicious trades.
4. Vendor applications and risk flags.
5. Users, roles, and restrictions.
6. Rate/provider/worker health.
7. Influencer submissions and ranking management.
8. Immutable administrative audit log.

Admin resolution screens must include evidence, chat, transaction/event facts, actor history, decision reasoning, and the exact on-chain action required.

## Shared components

- Dashboard shell and sidebar.
- Page header and contextual actions.
- Action-required queue.
- Financial amount and rate display.
- Trade state badge and state timeline.
- Data table with mobile transformation.
- Filter bar, saved views, pagination, and export.
- Risk alert and reconciliation alert.
- Empty, stale, offline, forbidden, and error views.
- Review/confirmation sheet for wallet actions.
- Audit event list.

## Interaction rules

- Urgent operational actions precede analytics.
- Terminal states cannot expose active-state actions.
- Disabled actions explain why.
- Optimistic UI may not represent financial settlement.
- A transaction progresses through wallet-requested, submitted, confirming, confirmed, and reconciled states.
- Background updates retain user context and announce material state changes accessibly.

## Implementation order

1. Capture current dashboard, trade, vendor, and admin screens.
2. Produce three visual directions grounded in the existing identity; select one before redesign.
3. Define navigation, tokens, primitives, and responsive behavior.
4. Extract current large pages into domain components without changing behavior.
5. Build member routes.
6. Build vendor operations.
7. Build admin exception queues.
8. Connect metrics to authoritative queries and add pagination.
9. Complete responsive, accessibility, realistic-data, and failure-state testing.

## Success criteria

- A user identifies their next required action within seconds.
- Financial state is never ambiguous or overstated.
- Vendor queues support time-sensitive work on mobile.
- Admin exceptions have ownership and audit history.
- Core screens meet the `DESIGN.md` accessibility baseline.
- Dashboard code no longer depends on a single multi-workflow page component.

