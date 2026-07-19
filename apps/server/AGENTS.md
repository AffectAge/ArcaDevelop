# Server guide

Always start from root `AGENTS.md` and `docs/README.md`.

Read root `AGENTS.md`. Also read security, API/WS, concurrency, observability, performance, database, and deletion docs routed from `docs/task-routing.md`.

## Boundaries

- `app/`: Express construction, global middleware, static serving.
- `routes/`: thin request boundary modules.
- `mechanics/`: pure or focused gameplay rules.
- `runtime/`: bounded orchestration and runtime primitives.
- `map/`: hex artifacts, indexes, graph and map runtime.
- `scenarios/` and `content/`: scenario loading, validation, content normalization.
- `persistence/`: Prisma and durable repositories.
- `security/`: authentication, authorization, policies, audit hooks.
- `uploads/`: scenario-scoped paths, validation, ownership, cleanup.
- `ai/`: indexes, filters, scoring, plans, validated order generation.

Do not move rules into routes, persistence into mechanics, or scenario validation into runtime helpers. Major restructuring requires an ADR and folder documentation.

## Authority and mutation

- Validate authorization, input, ownership, costs, cooldowns, and legality server-side.
- Mutations choose transaction, lock, queue, optimistic version, idempotency key, or explicit rejection.
- API/WS contracts use shared types and stable error codes; delta changes update producers, consumers, ACK/replay, tests, and docs.
- Important actions define permission, audit, rate-limit, cleanup, and safe player-error behavior.
- Important visible state changes emit structured explanations. Resource changes emit ledger flows; only ledger runtime/normalizers apply final country totals.

## Performance and safety

- Avoid N+1 queries and repeated full-world scans in resolver, AI, WS, economy, market, and map hot paths.
- Bound caches, queues, histories, retries, logs, metrics, and replay buffers; expose invalidation and useful phase metrics.
- Never add hidden gameplay fallback. Invalid scenario/config/localization data should fail validation; documented startup/recovery safety defaults are the only exception.
- Never log secrets, credentials, auth material, or private player/admin data.

## Mechanics and AI

Heavy mechanics use `regionId`; provinces remain movement/map nodes. Concrete content and tunables come from scenario data and modifiers. AI obeys the same order validation, costs, information, and permissions as players and is budgeted for many countries.
