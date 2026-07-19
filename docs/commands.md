# Command Registry

Agents must use existing commands honestly and update this file when commands are added, removed, or changed.

## Root Commands

```bash
npm install
```

Installs workspace dependencies and runs `postinstall`.

```bash
npm run dev
```

Starts server and client concurrently.

```bash
npm run build
```

Runs workspace builds.

```bash
npm run typecheck
```

Runs typecheck across workspaces through `npm run typecheck -ws`.

```bash
npm run verify
```

Regenerates the Prisma client, runs workspace typechecks, and runs the Vitest suite. Use this as the default pre-PR verification command for broad runtime/client changes.

```bash
npm run lint
```

Runs workspace ESLint across all client, server, and shared source trees, then checks root scripts. Client lint includes the official React Hooks recommended rules. `npm run lint:all` additionally checks every non-ignored lintable file in the repository.

```bash
npm run map:from-geojson
```

Builds map data from GeoJSON using `scripts/prepare-map-from-geojson.mjs`.

```bash
npm run map:perf:fixtures
npm run map:perf:fixtures -- default
npm run map:perf:fixtures -- 200k
```

Builds or reuses deterministic `360x160` (57,600 hex) and `500x400` (200,000 hex) client-streaming fixtures. The command uses the production shared generator and server client-artifact packer, then caches immutable manifest/navigation/chunk files under the ignored root `.generated/map-perf-fixtures/`. Pass `default` or `200k` to build one fixture; omitting the argument builds both.

```bash
npm run map:perf -- --url http://127.0.0.1:5173
npm run map:perf -- --url http://127.0.0.1:5173 --assert
npm run map:perf -- --url http://127.0.0.1:4173 --assert --screenshots
```

Ensures the selected fixtures, starts a bounded loopback-only read-only CORS server with production-equivalent map cache/content-encoding headers, and runs the Chrome DevTools Protocol benchmark against the auth-free `/hex-perf` surface. The surface mounts the production `MapView` without login/application-shell work and accepts its fixture API base only when the query points to an allowlisted loopback fixture path. The benchmark performs warmup plus 20 repeat pan cycles, wheel zoom, hover/picking, and a layer toggle; it reports phase timings, frame percentiles, hover/layer latency, long tasks, render counts, bounded cache size, retained heap/cache growth, and immutable-cache reuse after reopening. CDP commands and scripted interactions have bounded timeouts, the requested debugging port must be free, and the harness terminates only its own Chrome process tree during cleanup. `--assert` applies `docs/performance-budgets.md` and exits non-zero on missing metrics or regressions. Use `--screenshots` against a production preview to overwrite deterministic far/mid/near, reduced-motion, English, and Russian evidence under the ignored `.generated/map-perf/screenshots/` directory. The screenshot-only fixture seeds ownership, cities, and units on `/hex-perf`; it is not used by timed cases.

```bash
npm run map-assets:build
```

Regenerates deterministic Phaser terrain, object, border, river, fill, and unit bitmap atlases plus provenance/output hashes from `project_assets/map-art/`. The existing Sharp development dependency performs the offline build; generated runtime files live under `apps/client/public/game-assets/phaser/` and the default scenario unit-asset paths.

## Server Commands

```bash
npm run dev -w @arcanorum/server
npm run build -w @arcanorum/server
npm run typecheck -w @arcanorum/server
npm run prisma:generate -w @arcanorum/server
npm run prisma:push -w @arcanorum/server
npm run prisma:migrate -w @arcanorum/server
npm run tiles:build -w @arcanorum/server
npm run uploads:cleanup-orphans -w @arcanorum/server
```

`uploads:cleanup-orphans` targets scenario-owned uploads. Pass `-- --scenario <scenario_id>` to inspect a specific `data/scenarios/<scenario_id>/assets/uploads` tree; without it, the command uses `active`. The command is dry-run by default and requires `--apply` for deletion.

Use server commands for API/WS/runtime/scenario/persistence work. Destructive or cleanup commands require explicit user intent and should support dry-run/preview where practical.

## Client Commands

```bash
npm run dev -w @arcanorum/client
npm run build -w @arcanorum/client
npm run preview -w @arcanorum/client
npm run typecheck -w @arcanorum/client
npm run lint -w @arcanorum/client
```

Use client commands for UI, map, localization, Arcawiki, and admin workflow work.

## Missing But Expected Future Commands

Agents should propose or add these when implementing their systems:

```bash
npm run localization:check
npm run theme:validate
```

`test:e2e` and `test:integration` currently exist only as explicit placeholder scripts; they are not real coverage and must be replaced before being reported as verification. Do not pretend missing or placeholder commands provide coverage.

`scenario:validate` should validate strict per-entity JSON, stable-ID references, localization, assets, region/province membership, forbidden province-heavy fields, and generated index freshness. `scenario:build-indexes` should create or refresh `scenarios/<scenario_id>/.generated/` from authored per-entity files.

`scenario:generate-map` creates or refreshes server-authoritative generated hex map artifacts from `map/hex-settings.json`, including `.generated/hex-map.json`, `.generated/hexes.json`, and `.generated/regions.json`. Applying a scenario also refreshes these artifacts when the settings hash is stale.

`docs:check` verifies required documentation links, checks that `docs/README.md` lists required docs and templates from `.codex/project-rules.json`, checks that `.codex/project-rules.json` stays synchronized with runtime scenario contracts, and runs `scripts/check-code-guards.ts`. The project-rules sync verifies required entry points, core docs, template files, task-routing files, folder-level `AGENTS.md` files, mandatory folder-agent start lines, supported defines from `apps/server/src/scenarios/scenarioDefinesLoader.ts`, authored entity paths from `apps/server/src/scenarios/scenarioValidation.ts`, and forbidden province-heavy fields from `apps/server/src/scenarios/scenarioValidation.ts`. The code/data guard currently blocks reintroducing `sourceProperties`, `@ts-ignore`, broad `any` usage in guarded modules, root `apps/server/data/content-library.json`, province-heavy fields in authored `history/provinces/*.json`, hardcoded color values in `apps/client/src/components/templates`, and inline Cyrillic text in guarded client UI zones: `apps/client/src/components/templates`, `apps/client/src/components/map-hud`, and `apps/client/src/components/ClientSettingsModal.tsx`.

## Machine-Readable Rules

`.codex/project-rules.json` lists required docs, task routing, templates, forbidden patterns, guarded paths, and default verification commands for future automation. Update it when these lists change. `scripts/check-project-rules.ts` keeps guarded paths synchronized with `scripts/projectGuardConfig.ts`.
