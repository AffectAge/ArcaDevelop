# Refactoring Plan

This plan describes how to bring the current codebase toward the agent rules without turning cleanup into hidden gameplay, balance, or protocol changes. Use it for large implementation plans, server rewrite work, folder moves, and index/module splits.

## Goals

- Split monolithic files into clear modules that match `docs/folder-structure.md`.
- Move heavy mechanics toward the region-first world model in `docs/world-model.md`.
- Keep provinces lightweight for map, movement, terrain, climate, passability, adjacency, and local deposits only.
- Move scenario authored data toward strict per-entity JSON files and generated indexes.
- Keep the server authoritative and route all player and AI actions through normal validation.
- Preserve zero-territory country support.
- Make future changes easier to test, review, document, and clean up.

## Non-Goals

- Do not rewrite the whole project in one task.
- Do not change gameplay balance inside structural refactors.
- Do not add compatibility with old saves or old scenario formats unless explicitly requested.
- Do not introduce new dependencies as part of cleanup without approval and rationale.
- Do not move code only to make folders look tidy if ownership remains unclear.

## Refactor Order

### 1. Inventory And Safety Rails

- Identify the files, routes, contracts, mechanics, scenario data, localization, and docs touched by the task.
- Check relevant `AGENTS.md`, `docs/task-routing.md`, `docs/programming-standards.md`, and `docs/folder-structure.md`.
- List intended behavior changes separately from behavior-preserving moves.
- Decide whether an ADR is required.
- Add or update guard checks before broad moves when the same mistake can easily return.

Evidence to collect:

- current command/test coverage,
- known missing commands,
- affected public contracts,
- affected scenario and generated data,
- affected cleanup/deletion paths.

### 2. Contracts And Types

- Move shared API, WS, world, order, delta, scenario, error, and AI types into `packages/shared/src/*` according to `docs/folder-structure.md`.
- Keep `packages/shared/src/index.ts` as a barrel only after split.
- Add stable error codes before exposing new API/WS failures.
- Keep raw boundary inputs separate from validated domain types.

Do not:

- duplicate client/server contract shapes,
- add broad casts to push a move through,
- change protocol payloads without `docs/api-ws-versioning.md` updates.

### 3. Scenario And Content Loading

- Convert authored scenario data toward one entity per strict JSON file.
- Keep generated indexes under `scenarios/<scenario_id>/.generated/`.
- Reject invalid scenario data loudly instead of defaulting gameplay values.
- Keep balance, pacing, limits, and AI bonuses in scenario defines.
- Keep scenario-owned assets under scenario ownership and cleanup lifecycle rules.

Priority areas:

- `history/provinces/*.json`,
- `history/regions/*.json`,
- `history/countries/*.json`,
- `history/diplomacy/*/*.json`,
- `common/*/*.json`,
- `common/ai/*/*.json`,
- `arcawiki/entries/*.json`,
- `theme/*`.

### 4. Server Index Split

Move code out of `apps/server/src/index.ts` by responsibility, not by line count:

- app setup and middleware -> `apps/server/src/app/`,
- HTTP routes -> `apps/server/src/routes/`,
- WS auth/routing/deltas -> `apps/server/src/ws/`,
- turn/runtime orchestration -> `apps/server/src/runtime/`,
- mechanics -> `apps/server/src/domain/<domain>/`,
- scenario loading/application -> `apps/server/src/scenarios/`,
- content loading/Arcawiki -> `apps/server/src/content/`,
- map/province graph/tiles -> `apps/server/src/map/`,
- persistence adapters -> `apps/server/src/persistence/`,
- permissions/audit/security -> `apps/server/src/security/`,
- metrics/diagnostics -> `apps/server/src/observability/`.

Rules:

- route handlers stay thin,
- domain functions should be testable without HTTP/WS/DB,
- mutating flows must choose a concurrency strategy,
- no new full-world scans in hot paths without indexes and justification.

### 5. Region-First Mechanics Migration

- Move population, buildings, construction, economy, taxes, colonization, diplomacy territory transfer, and heavy resources to regions.
- Leave province code for graph, rendering, movement, terrain, climate, passability, movement cost, local sites, and local deposits.
- Convert old province-heavy names and data only when the surrounding behavior can be verified.
- Update docs, tests, Arcawiki, scenario validator, and cleanup lifecycle for each migrated mechanic.

Each mechanic migration must report:

- old owner and new owner,
- affected order pipeline,
- cleanup/deletion implications,
- AI implications,
- performance implications,
- tests run and missing tests.

### 6. AI And Control Modes

- Keep AI output as normal validated orders.
- Keep AI profiles scenario-owned.
- Support `player`, `ai`, and `open` control modes.
- Switching player <-> AI clears orders/plans as documented and writes audit logs.
- Preserve zero-territory AI and country behavior.
- Budget AI ticks for roughly 100-200 AI countries and avoid full-world scans.

### 7. Client Split

Move client code toward:

- app shell/providers -> `apps/client/src/app/`,
- reusable UI primitives and modal templates -> `apps/client/src/components/templates/`,
- map HUD -> `apps/client/src/components/map-hud/`,
- domain views -> `apps/client/src/features/<domain>/`,
- localization -> `apps/client/src/i18n/`,
- theme loading/tokens -> `apps/client/src/theme/`,
- map layers/selectors -> `apps/client/src/map/`.

Rules:

- all visible text uses localization keys with English and Russian values,
- visual values use theme tokens,
- admin UI cannot be the only permission barrier,
- map changes must respect UI frame budgets,
- Arcawiki stays player-facing and non-technical.
- agents creating or changing reusable UI must use `apps/client/src/components/templates/DEMO_ELEMENTS.md`, update it when adding template components, and avoid recreating removed `components/ui` primitives.

### 8. Cleanup And Deletion Lifecycle

Every refactor that removes or changes an entity/mechanic must check:

- code,
- scenario data,
- generated indexes,
- uploaded assets,
- localization keys,
- Arcawiki entries,
- docs,
- tests,
- audit logs,
- WS delta/resync behavior.

Do not leave dead files, stale generated data, orphan uploads, or old docs that describe removed behavior.

### 9. Verification

For each refactor batch, run the narrowest useful checks plus broad project guards:

- `npm run docs:check`,
- `npm run lint`,
- `npm run typecheck` or workspace typecheck when code contracts change,
- relevant unit/integration tests when they exist,
- scenario validation when scenario/content/map/AI/localization/theme/assets change,
- manual scenario notes for gameplay behavior.

If a required command does not exist, say that directly and either add it in scope or list it as follow-up.

## Batch Template

Use this structure before a non-trivial refactor:

```md
## Refactor Batch
- Area:
- Reason:
- Behavior change intended: no/yes
- Files/modules expected to move:
- Public contracts affected:
- Scenario/content affected:
- Docs/Arcawiki/localization/theme affected:
- Tests/checks to run:
- Risks:
- Rollback plan:
```

## Recommended First Batches

1. Keep strengthening project guards for docs, forbidden data, localization, theme tokens, and scenario generated data.
2. Extract server app/route/WS wiring from `apps/server/src/index.ts` without changing behavior.
3. Move shared contract types into `packages/shared/src/contracts`, `world`, `orders`, `deltas`, `errors`, and `scenarios`.
4. Finish scenario per-entity loader/validator and generated index tooling.
5. Move existing province-heavy mechanics toward region-owned domain modules one mechanic at a time.
6. Split client map/HUD/admin UI into `features`, `i18n`, `theme`, and `map` modules.
7. Add missing test commands and fixture scenarios for mechanics, AI, scenario loading, and deletion lifecycle.

## Completion Standard

A refactor batch is done only when:

- behavior changes are explicit and approved,
- imports/builds/checks pass for the touched area,
- docs and AGENTS routing remain current,
- no dead code/data/assets were introduced,
- final report explains what changed, why, checks run, skipped checks, risks, failure modes, and mitigations.
