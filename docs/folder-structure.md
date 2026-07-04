# Folder Structure

This document is the source of truth for repository layout. Agents must update it when adding, removing, renaming, or significantly repurposing folders.

## Current Top-Level Layout

```text
apps/
  client/
  server/
packages/
  shared/
docs/
scripts/
project_assets/
```

- `apps/client` contains the React/Vite client.
- `apps/server` contains the authoritative server, scenario data, uploads, Prisma, and server scripts.
- `packages/shared` contains shared client/server contracts.
- `docs` contains technical documentation and agent rules.
- `scripts` contains root-level build/data preparation scripts.
- `project_assets` contains source/reference assets, not scenario-owned runtime uploads.

Repo-owned base client assets that are part of the game itself live under `apps/client/public/game-assets/`. Resource point icons use `apps/client/public/game-assets/resource-icons/*.png`; generated hex terrain material textures use `apps/client/public/game-assets/hex-materials/*.png`. These assets are not scenario-owned uploads and are not configured through runtime game settings.
Repo-owned fallback art uses the same tree; for example, the login/loading background fallback is `apps/client/public/game-assets/utils/fallback-auth-background.png` when the active scenario does not provide `assets/utils/auth-background.png`.

## Target Server Layout After Refactor

Server code should move away from a giant `src/index.ts` toward:

```text
apps/server/src/
  app/
  runtime/
  ws/
  routes/
  domain/
    regions/
    movement/
    economy/
    population/
    colonization/
    diplomacy/
    military/
    politics/
    technology/
    ai/
  content/
  scenarios/
  uploads/
  map/
  persistence/
  security/
  observability/
  testing/
```

Folder responsibilities:

- `app`: Express app creation, middleware, HTTP wiring.
- `runtime`: world runtime, turn state, scenario activation, orchestration.
- `ai`: deterministic AI context builders, indexes, fixture harnesses, rule filters, scoring, plans, and future AI order generation.
- `ws`: WebSocket auth, routing, ACK/replay, interest management.
- `routes`: HTTP route modules only; keep handlers thin.
- `domain`: pure or mostly pure mechanics and domain rules.
- `content`: content library loading, normalization, validation, Arcawiki loading.
- `scenarios`: scenario manifest, region/country/history loading, scenario application.
- `uploads`: scenario-scoped uploads, validation, references, cleanup.
- `map`: province graph, region membership, tiles, map runtime.
- `persistence`: Prisma repositories, persistence adapters, delta log storage.
- `security`: permissions, auth helpers, audit policies.
- `observability`: metrics, diagnostics, bounded logs.
- `testing`: test fixtures and deterministic scenario helpers.

Current migration note: `apps/server/src/runtime` has started with small runtime primitives such as bounded TTL caches. `apps/server/src/ai` contains the first deterministic AI context/index and fixture harness modules. Keep generic runtime helpers in `runtime` when they are not persistence adapters, route handlers, security rules, or domain mechanics.

## Target Client Layout After Refactor

```text
apps/client/src/
  app/
  components/
    ui/
    map-hud/
    feature/
  features/
    regions/
    movement/
    economy/
    diplomacy/
    military/
    politics/
    ai-admin/
    arcawiki/
  store/
  lib/
  i18n/
  theme/
  map/
  testing/
```

Folder responsibilities:

- `app`: app shell, providers, high-level orchestration.
- `components/ui`: reusable generic UI primitives.
- `components/map-hud`: map overlay controls and HUD components.
- `components/feature`: temporary bridge for obsolete feature components during migration.
- `features`: domain-oriented UI modules.
- `store`: client state slices and selectors.
- `lib`: small client adapters, API clients, and utilities with clear ownership.
- `i18n`: localization keys, helpers, and validation.
- `theme`: scenario theme loading and token application.
- `map`: map-specific layers, selectors, and rendering helpers.
- `testing`: client fixtures and test helpers.

## Target Shared Layout After Refactor

```text
packages/shared/src/
  contracts/
  world/
  orders/
  deltas/
  errors/
  scenarios/
  ai/
  index.ts
```

- `contracts`: public API/WS contract types.
- `world`: world model types such as regions, provinces, countries.
- `orders`: order types and order result types.
- `deltas`: world delta masks/payloads and compact protocol types.
- `errors`: stable error codes.
- `scenarios`: scenario file contracts.
- `ai`: AI profile/config contracts.
- `index.ts`: barrel exports only after split.

## Target Scenario Layout

Scenario structure is defined in `docs/modding-authoring.md` and `docs/scenario-region-history.md`:

```text
apps/server/data/scenarios/<scenario_id>/
  scenario.json
  history/
    provinces/
    regions/
    countries/
    diplomacy/
      relations/
      treaties/
  common/
    defines.json
    goods/
    buildings/
    technologies/
    laws/
    cultures/
    religions/
    ideologies/
    professions/
    races/
    markets/
    modifiers/
    map_feature_generators/
    map_feature_visuals/
    ai/
      archetypes/
      personalities/
      strategies/
  localisation/
  arcawiki/
    entries/
  theme/
  assets/uploads/
  .generated/
```

Scenario-owned data/assets must stay under the scenario unless explicitly approved.

Authored scenario data uses one entity per strict JSON file. The JSON `id` is authoritative; file names are human-readable only. Generated indexes live under `.generated/` and are not manual source.

## Placement Rules

- Put new files near the domain they serve.
- Prefer domain folders over technical dumping grounds.
- Use route modules for transport and domain modules for rules.
- Use adapters for third-party boundaries.
- Keep shared contracts in `packages/shared`; do not duplicate contract types in client/server.
- Keep player-facing docs in Arcawiki and technical docs in `docs`.
- Keep generated/build artifacts out of source folders unless the project intentionally owns them.
- Keep scenario generated indexes only in `scenarios/<scenario_id>/.generated/`.

## Adding New Folders

Do not create a new folder by instinct. Create one only when a new mechanic, subsystem, or boundary does not fit existing folders without mixing responsibilities.

Before adding a folder, check existing candidates:

- `domain/*`
- `features/*`
- `routes/*`
- `scenarios/*`
- `content/*`
- `map/*`
- `security/*`
- `observability/*`
- `uploads/*`
- `persistence/*`
- `i18n/*`
- `theme/*`

If an existing folder fits, use it. If none fits, the new folder must have a clear domain responsibility and a stable name. Name it after the domain or boundary, not a temporary use-case.

Good examples:

```text
apps/server/src/domain/logistics/
apps/client/src/features/regions/
packages/shared/src/errors/
```

Bad examples:

```text
apps/server/src/helpers/newMechanicStuff/
apps/client/src/misc/
packages/shared/src/random/
```

### New Folder Proposal

For non-trivial new folders, include this proposal in the plan or final report:

```md
## New Folder Proposal
- Path:
- Purpose:
- Why existing folders do not fit:
- Allowed contents:
- Forbidden contents:
- Public interfaces:
- Related docs/tests:
- Cleanup/ownership implications:
- ADR required: yes/no
```

An ADR is required when the new folder represents a major architecture area, protocol boundary, persistence boundary, scenario format area, AI subsystem, or cross-cutting dependency/tooling decision.

For new gameplay-mechanic folders, the proposal must confirm the mechanic follows the region-first model and does not add province-heavy simulation without explicit approval.

## Forbidden Structure Patterns

- New catch-all folders like `misc`, `helpers`, `stuff`, or broad `utils` without a narrow topic.
- New root-level folders without updating this document and explaining ownership.
- Scenario runtime uploads stored in `project_assets`.
- Client/server duplicate copies of shared contract types.
- More code added to a monolithic `index.ts` when a domain folder exists or should be created.
- New feature folders that mix UI, server, persistence, and scenario data together.

## Maintenance Rule

Any task that changes folder layout must update:

- this document,
- `docs/README.md` if a new documentation area is added,
- relevant `AGENTS.md`,
- import paths and command docs if commands/scripts move,
- final report with the reason for the structural change.
