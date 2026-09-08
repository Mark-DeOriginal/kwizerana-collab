# Kwizerana Product and Interface Direction

## Design objective

Kwizerana should feel like a trustworthy, human-designed financial and research product: calm, legible, specific, and operationally useful. It should not resemble a generic AI-generated SaaS or crypto template.

This document defines direction, not a frozen mockup. Before a major redesign, capture the current screens, produce three grounded visual directions, select one, then implement it consistently.

## Product character

- **Trustworthy:** facts and state are more prominent than promotion.
- **Human:** plain language, thoughtful empty states, restrained personality.
- **Precise:** financial amounts, status, responsibility, and consequences are explicit.
- **Distinct:** retain Kwizerana's ocean, moss, mint, ink, and warm-neutral character.
- **Quietly confident:** minimal decoration, deliberate color, strong typography.

## Avoid generic UI

Do not default to:

- four interchangeable metric cards at the top of every page;
- glowing crypto gradients, glass panels, neon tokens, or decorative candlestick charts;
- oversized rounded cards nested inside more rounded cards;
- vague copy such as “unlock the future of finance”;
- excessive badges, pills, shadows, and icon containers;
- charts without a decision or question they help answer;
- fabricated testimonials, volume, wallet balances, or security claims.

## Visual system

The existing semantic palette should be formalized rather than discarded:

- `ink`: primary text, decisive actions, high-contrast surfaces.
- `ocean`: links, selection, interactive emphasis, verified information.
- `moss`: success, completion, healthy state.
- `mint`: low-emphasis positive background.
- `coral`: destructive actions, risk, expiry, and urgent attention.
- `panel`, `line`, `muted`: surfaces, boundaries, and secondary content.

Color must never be the only status indicator. Pair it with text and an icon where useful.

Use a compact, editorial type hierarchy. Financial values use tabular numerals. Keep body text readable and avoid tiny all-caps labels for essential information.

Surfaces should use subtle borders and limited elevation. Radius, shadow, spacing, and control heights must come from a small documented scale rather than one-off values.

## Shared application shell

- Public marketing/archive pages use the existing top navigation and footer.
- Signed-in operational pages use a role-aware dashboard shell.
- Desktop dashboard navigation uses a collapsible sidebar.
- Mobile uses a compact drawer or bottom navigation for the most important destinations.
- The page header contains title, short context, and no more than two primary actions.
- Deep pages may use breadcrumbs; top-level pages should not.

## Core experience principles

### P2P market

- Make Buy and Sell unmistakable.
- Always show asset, fiat, effective rate, limits, fee, available inventory, payment methods, vendor reputation, and expected release time.
- Explain whether a price is fixed, floating, or adjusted by a vendor margin.
- Do not imply inventory is on-chain verified unless it is.

### Trade detail

Show a single authoritative state timeline:

`Requested -> Escrow funding -> Fiat payment -> Confirmation -> Claim -> Completed`

Dispute, cancellation, expiry, and refund are branches with explicit consequences. The page must state who acts next, the deadline, what is on-chain, and what is only recorded off-chain.

Irreversible wallet actions require a review step containing network, contract, token, amount, destination, and estimated cost. Explorer links appear only after a real verified transaction exists.

### Influencer archive

Treat the archive as a research tool. Optimize search, filtering, comparison, provenance, freshness, and credibility. Avoid turning each profile into an oversized promotional card.

### Administration

Admin UI is an exception-handling console. Prioritize queues, risk, SLA, evidence, ownership, and audit history over decorative analytics.

## Dashboard direction

See `docs/DASHBOARD-PLAN.md`. In summary:

- Member dashboard: attention, active orders, wallet connections, payment methods, reputation, and security.
- Vendor dashboard: order queue, escrow actions, ads, inventory, pricing, performance, availability, and disputes.
- Admin dashboard: disputes, stalled or inconsistent trades, vendor applications, users, rates, archive review, configuration, and audit logs.

## Content style

- Use direct verbs: “Fund escrow”, “Mark payment sent”, “Confirm receipt”, “Claim USDT”.
- Name the actor: “Waiting for the seller to fund escrow.”
- State consequences before destructive or irreversible actions.
- Avoid implying guarantees the system cannot prove.
- Explain uncommon terms in context; do not overload screens with help text.
- Dates include timezone where operationally relevant. Amounts include currency and network.

## Required states

Every data-driven component must consider:

- initial loading and background refresh;
- empty and filtered-empty results;
- recoverable error and retry;
- offline/stale data;
- unauthorized and forbidden;
- expired action;
- pending wallet signature;
- submitted but unconfirmed blockchain transaction;
- confirmed transaction;
- database/on-chain reconciliation failure.

## Accessibility baseline

- Target WCAG 2.2 AA.
- Provide a skip link and visible `:focus-visible` treatment.
- Use semantic landmarks, headings, labels, tables, and buttons.
- Menus, dialogs, tabs, listboxes, and disclosure widgets require complete keyboard behavior and focus management.
- Announce validation errors and async status changes.
- Maintain at least 44 by 44 CSS-pixel touch targets for primary mobile controls.
- Support 200% zoom, narrow reflow, reduced motion, and screen readers.
- Do not infer compliance from screenshots; test keyboard and assistive-technology behavior.

## Responsive behavior

- Design mobile trade actions first because P2P activity is time-sensitive.
- Replace wide tables with prioritized mobile rows/cards, not horizontal squeezing.
- Keep the current required action visible without hiding critical context.
- Use sticky actions sparingly and account for safe areas and the on-screen keyboard.

## Definition of design-ready

A surface is ready to implement when its user, goal, data, states, primary action, failure modes, responsive behavior, and accessibility requirements are known. A surface is ready to ship only after visual comparison, interaction testing, responsive testing, keyboard testing, and realistic-data review.

