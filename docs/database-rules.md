# Database Rules

## Prisma And Schema

- Use Prisma/schema workflows for database shape changes.
- Do not hand-edit SQLite state as an implementation shortcut.
- Document whether a DB change needs migration, reset, or no compatibility.

Current additive runtime compatibility:

- `GameState.adminAuditLogJson` is part of the Prisma schema. Server startup/table bootstrap adds this column to older SQLite databases if it is missing. This does not require deleting existing local state.
- Runtime table bootstrap lives in `apps/server/src/persistence/dbBootstrap.ts`. Keep additive startup compatibility there rather than growing `apps/server/src/index.ts`.
- Runtime `GameState` row save/load is owned by `apps/server/src/persistence/gameStatePersistence.ts`; `apps/server/src/index.ts` should only assemble/apply runtime state and migration hooks.
- Debounced runtime state persistence is scheduled by `apps/server/src/persistence/persistentStateScheduler.ts` and must remain serial, bounded, and test-covered.
- obsolete JSON `game-state.json` import is read through `apps/server/src/persistence/persistedStateFile.ts`; parsing raw files should not grow in `apps/server/src/index.ts`.
- obsolete `content-library.json` file IO is removed. Do not restore root content-library persistence; runtime content is stored in `GameState`, and authored scenario content belongs under `scenarios/<scenario_id>/common/*/*.json`.
- Persisted world-delta replay rows are owned by `apps/server/src/persistence/worldDeltaLogPersistence.ts` and must stay bounded/pruned.

## Hot Paths

- Avoid N+1 queries in resolver, WS auth, state sync, AI ticks, market/economy loops, and admin dashboards.
- Prefer batched queries and indexed lookups.
- Do not persist large runtime blobs without a clear ownership and pruning policy.

## Destructive Operations

Destructive DB operations need:

- explicit confirmation,
- authorization,
- audit log,
- transaction where practical,
- dry-run or preview where practical,
- cleanup lifecycle for dependent entities/assets.

## Concurrency

Mutating DB flows must choose transaction, lock, queue, optimistic version, idempotency key, or explicit rejection.
