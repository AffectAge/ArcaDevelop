# New Folder Proposal: Client Map Rendering

## Summary

- Path: `apps/client/src/map/rendering/`
- Purpose: isolate the Phaser canvas adapter, scenes, texture manifest, chunk tile layers, sprite pools, and typed React bridge.
- Task/feature requiring it: hard replacement of the Pixi mesh/shader map renderer.

## Fit Check

- Existing folders considered: `components/`, `map/`, and a framework-named `map/phaser/` folder.
- `components/` should contain React UI, not a game-engine scene graph. Existing `map/` remains the correct subsystem root, but needs one explicit rendering boundary so geometry, pathfinding, streaming, and gameplay selectors remain engine-independent.
- `rendering` names a stable responsibility; it remains valid if the underlying renderer changes later.

## Boundaries

- Allowed contents: Phaser lifecycle, scenes, tile/sprite layers, camera/input, visual snapshots, texture loading, renderer diagnostics, and renderer-specific tests.
- Forbidden contents: server rules, order validation, authoritative pathfinding, Zustand ownership, React HUD components, localization strings, scenario balance, and direct API calls.
- Public interfaces: a small typed controller created by the React `MapView` adapter and immutable render snapshots/intents.
- Owner/subsystem: client map presentation.
- Related docs: ADR-0012, `docs/hexes-and-regions.md`, `docs/performance-budgets.md`, and `docs/theme-system.md`.
- Related tests: projection/picking, tile layers, dirty borders, sprite pooling, lifecycle, and browser playtests.

## Architecture

- ADR required: yes; ADR-0012.
- Import/export strategy: barrel only for the small public bridge; internal renderer modules use direct relative imports.
- Cleanup/ownership implications: deleting the folder and adapter removes Phaser without changing shared map contracts.
- Commands affected: client typecheck/build, unit tests, map performance measurement, and browser smoke tests.

## Final Review

- `docs/folder-structure.md` updated: pending implementation.
- Relevant `AGENTS.md` updated: pending instruction audit.
- Docs/commands updated if needed: pending performance-harness migration.

