# Database Direction

## Current implementation

The application uses Neon serverless PostgreSQL through `@neondatabase/serverless`. `lib/db.ts` contains `dbQuery()`, the complete schema statement list, and `ensureDatabase()`.

`ensureDatabase()` executes schema/data statements in one transaction under a PostgreSQL advisory lock. Many domain functions call it before querying.

## Decision

Keep PostgreSQL/Neon, but replace request-time schema creation with versioned migrations before production.

The migration system must provide:

- ordered immutable migration files;
- a migration history table;
- staging rehearsal and rollback/forward-fix procedures;
- compatibility rules for rolling deployments;
- explicit data migrations separate from request handling;
- backup and restoration checks before destructive changes.

## Financial data rules

- Use `NUMERIC` or integer base units; never floating-point arithmetic for settlement.
- Add check constraints for allowed states, positive amounts, deadlines, and supported assets.
- Add unique constraints for idempotency keys and chain event identity.
- Use transactions and row-level locks for trade/escrow mutations.
- Write transition audit events and an outbox record in the same commit.
- Treat on-chain events as financial evidence and the database as a verified projection.

## Privacy and operations

- Minimize and protect payment account and receipt data.
- Define retention and deletion rules.
- Audit privileged reads and writes.
- Configure point-in-time recovery, restoration drills, monitoring, and connection limits.
- Never seed production with demo vendors or mock transaction hashes.

See `docs/ARCHITECTURE.md` and `docs/PRODUCTION-READINESS.md`.

