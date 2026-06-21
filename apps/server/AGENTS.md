# Server Agents

Always start from root `AGENTS.md` and `docs/README.md` before using this folder guide.

Use this guide for `apps/server`.

Also read:

- `docs/security-baseline.md`
- `docs/secrets-policy.md`
- `docs/database-rules.md`
- `docs/api-ws-versioning.md`
- `docs/concurrency.md`
- `docs/observability.md`
- `docs/performance-budgets.md`
- `docs/data-deletion-lifecycle.md`
- `docs/engineering-standards.md`

## Server Architecture Agent

The current server runtime must move toward a modular architecture instead of a giant `src/index.ts`.

Target modules:

- `app/` Express app creation and middleware.
- `runtime/` world runtime, turn state, scenario activation, server context.
- `ws/` WebSocket auth, routing, ACK/replay, interest management.
- `routes/` REST route modules.
- `domain/` mechanics modules.
- `content/` content and Arcawiki loading/validation.
- `scenarios/` scenario manifest/loading/application.
- `uploads/` scenario-scoped upload validation and cleanup.
- `map/` province graph, region membership, tiles, map runtime.
- `persistence/` Prisma/game-state/delta-log repositories.
- `security/` permission policies and audit hooks.
- `ai/` rule filters, utility scoring, plans, and AI order generation.

Do not perform casual refactors. Server rewrites must preserve intended behavior unless the user explicitly approves removal/replacement.

Major server architecture decisions require an ADR.

## Security And Permission Agent

Server-side authorization is mandatory for every admin or privileged operation. Client-side UI hiding is not security.

New or changed mutations must define:

- permission policy,
- stable error codes,
- audit behavior,
- rate-limit need,
- safe player-facing error behavior.

Never log secrets, passwords, JWTs, auth headers, cookies, or private player/admin data.

## Database And Concurrency Agent

Database shape changes use Prisma/schema workflows. Do not hand-edit runtime DB state as an implementation shortcut.

Hot paths must avoid N+1 queries and repeated full-world scans. Mutating flows must choose a concurrency strategy: transaction, lock, queue, optimistic version, idempotency key, or explicit rejection.

Destructive DB operations need authorization, confirmation, audit, transaction where practical, and dry-run/preview where practical.

## Observability Agent

Heavy server systems need bounded metrics/logs and admin diagnostics:

- turn resolve phases,
- AI ticks,
- WS traffic/replay/snapshot fallback,
- order queues/rejections,
- economy/market ticks,
- scenario validation,
- content loading,
- upload cleanup.

Do not add unbounded in-memory arrays for metrics or logs.

Important gameplay calculations must also produce structured explanation records when they change visible values such as resources, population, legitimacy, production, market access, migration, radicalism, construction, technology, diplomacy, or colonization. Explanation records should include turn, affected object, previous value, new value, causes, source systems, related modifiers, and related events.

## API And WS Contract Agent

API/WS changes require typed payloads, stable message/endpoint names, stable error codes, authorization policy, idempotency decision, compatibility/removal decision, and tests.

World delta changes must update shared types, server producers, client consumers, ACK/replay behavior, and tests.

## Region Mechanics Agent

Heavy mechanics must use `regionId`, not `provinceId`, unless explicitly approved:

- population,
- buildings,
- construction,
- resources,
- production,
- taxes,
- colonization,
- diplomacy territory transfer,
- regional modifiers.

Region ownership uses:

- legal owner,
- current controller,
- core countries,
- detailed claims.

The controller receives the region economy. Diplomacy transfers whole regions. Colonization targets whole regions.

Bonuses, penalties, multipliers, and rule changes must be expressed through the shared modifier system. Do not add law/technology/building-specific conditionals directly inside mechanic calculations when a data-authored modifier can represent the rule.

## Province Movement Agent

Provinces are graph nodes for movement and map behavior.

First supported properties:

- adjacency,
- terrain/landscape,
- climate,
- movement cost,
- passability,
- coordinates/map metadata.

Region owner/controller determines access and supply rules. Do not move heavy economic or population simulation back to provinces.

## Scenario And Country Agent

Scenarios define ready-made countries in `history/countries/<country_id>.json`.

Country control modes:

- `player`,
- `ai`,
- `open`.

Countries may start with no territories. Server code must not assume a country owns regions or provinces.

Admins may switch control modes. Defines may enable automatic AI takeover after missed turns/offline time. Switching player <-> AI clears current orders/plans and must be audit-logged.

## Game AI Agent

AI must:

- use the same order pipeline as players,
- obey costs, cooldowns, ownership, limits, permissions, and scenario rules,
- avoid hidden information by default,
- avoid cheats unless explicitly configured in scenario defines,
- run in budgeted ticks,
- cache/derive indexes instead of scanning the whole world repeatedly,
- expose narrative outcomes to players, not raw utility scores,
- keep debug/explain data admin-only or test-only.

AI config belongs in scenario `common/ai/`.

Required tests for AI work:

- rule filter tests,
- utility scoring tests,
- fixture scenario tests,
- multi-turn metric-range simulations.

## Fallback Policy

Do not create hidden gameplay fallback. If scenario data, AI config, localization, or mechanics are invalid, surface validation errors. Technical safety defaults for startup/security/recovery are allowed only when documented and reported.
