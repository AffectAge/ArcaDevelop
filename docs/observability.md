# Observability

Heavy systems require bounded observability.

## What To Measure

- Turn resolve duration by phase.
- AI tick duration and skipped/degraded decisions.
- WS messages, bytes, replay requests, snapshot fallbacks, fanout.
- Order queue size and rejected order counts.
- Market/economy tick duration.
- Scenario validation duration and failures.
- Content loading duration.
- Upload cleanup counts.
- Map/source loading errors.
- Memory/cache sizes for bounded caches.

## Rules

- Metrics must be bounded.
- No unbounded in-memory arrays.
- Admin diagnostics must be permission-gated.
- Logs must avoid secrets and private player/admin data.
- Metrics should use stable names so regressions can be compared.
- Persisted WS/world-delta replay diagnostics are bounded by `MAX_PERSISTED_WORLD_DELTA_LOG` and handled through `apps/server/src/persistence/worldDeltaLogPersistence.ts`.
- Short-lived async query caches should use `apps/server/src/runtime/ttlAsyncCache.ts` or another bounded cache with explicit invalidation.
