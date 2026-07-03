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

Runs ESLint for the currently wired server AI/app/scenario/map/lifecycle/security/persistence/runtime/routes/uploads modules, shared package sources, and project check scripts. This is a partial lint pass, not whole-repository lint coverage.

```bash
npm run map:from-geojson
```

Builds map data from GeoJSON using `scripts/prepare-map-from-geojson.mjs`.

```bash
node scripts/measure-hex-map-performance.mjs --url http://127.0.0.1:5175
```

Runs a Chrome DevTools Protocol benchmark for 50k/200k hex map cases against a running client dev server.

```bash
node scripts/generate-hex-material-textures.mjs
```

Regenerates project-owned hex terrain albedo/detail PNG atlases under `apps/client/public/game-assets/hex-materials/`.

```bash
npm run hex-masks:generate
```

Regenerates project-owned grayscale coastline, biome transition, and river mask atlases under `apps/client/public/game-assets/hex-materials/`.

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
```

Use client commands for UI, map, localization, Arcawiki, and admin workflow work.

## Missing But Expected Future Commands

Agents should propose or add these when implementing their systems:

```bash
npm run test
npm run test:unit
npm run test:e2e
npm run scenario:validate -- --scenario <scenarioId>
npm run scenario:build-indexes -- --scenario <scenarioId>
npm run scenario:generate-map -- --scenario default
npm run localization:check
npm run theme:validate
npm run docs:check
```

Do not pretend missing commands exist until package scripts are added.

`scenario:validate` should validate strict per-entity JSON, stable-ID references, localization, assets, region/province membership, forbidden province-heavy fields, and generated index freshness. `scenario:build-indexes` should create or refresh `scenarios/<scenario_id>/.generated/` from authored per-entity files.

`scenario:generate-map` creates or refreshes the server-authoritative generated hex map artifacts for the built-in `default` scenario, including `.generated/hex-map-artifact.json`, `.generated/hexes.json`, and `.generated/regions.json`.

`docs:check` verifies required documentation links, checks that `docs/README.md` lists required docs and templates from `.codex/project-rules.json`, checks that `.codex/project-rules.json` stays synchronized with runtime scenario contracts, and runs `scripts/check-code-guards.ts`. The project-rules sync verifies required entry points, core docs, template files, task-routing files, folder-level `AGENTS.md` files, mandatory folder-agent start lines, supported defines from `apps/server/src/scenarios/scenarioDefinesLoader.ts`, authored entity paths from `apps/server/src/scenarios/scenarioValidation.ts`, and forbidden province-heavy fields from `apps/server/src/scenarios/scenarioValidation.ts`. The code/data guard currently blocks reintroducing `sourceProperties`, `@ts-ignore`, broad `any` usage in guarded modules, root `apps/server/data/content-library.json`, province-heavy fields in authored `history/provinces/*.json`, hardcoded color values in `apps/client/src/components/ui`, and inline Cyrillic text in guarded client UI zones: `apps/client/src/components/ui`, `apps/client/src/components/map-hud`, and `apps/client/src/components/ClientSettingsModal.tsx`.

## Machine-Readable Rules

`.codex/project-rules.json` lists required docs, task routing, templates, forbidden patterns, guarded paths, and default verification commands for future automation. Update it when these lists change. `scripts/check-project-rules.ts` keeps guarded paths synchronized with `scripts/projectGuardConfig.ts`.
