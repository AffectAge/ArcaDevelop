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
- Map manifest/chunk fetch, decode, worker-build, GPU-upload, and first-interactive durations.
- Map frame p50/p95/p99, long-task count, render count, resident/visible chunks, cache bytes, visible tiles, and visible sprites.
- Natural RenderTexture layer count, visible logical natural objects, approximate GPU bytes, bake p95/p99, chunk create/destroy p95, selected LOD, and detail-layer budget fallbacks.

## Rules

- Metrics must be bounded.
- No unbounded in-memory arrays.
- Admin diagnostics must be permission-gated.
- Logs must avoid secrets and private player/admin data.
- Metrics should use stable names so regressions can be compared.
- Persisted WS/world-delta replay diagnostics are bounded by `MAX_PERSISTED_WORLD_DELTA_LOG` and handled through `apps/server/src/persistence/worldDeltaLogPersistence.ts`.
- Short-lived async query caches should use `apps/server/src/runtime/ttlAsyncCache.ts` or another bounded cache with explicit invalidation.
- Browser map diagnostics keep only bounded rolling samples and are enabled by the explicit performance/debug surface. Normal player sessions must not retain unbounded frame or interaction histories.
- Map chunk errors use stable artifact/chunk identifiers and safe error codes; do not log player tokens, private world state, or raw authored payloads.
