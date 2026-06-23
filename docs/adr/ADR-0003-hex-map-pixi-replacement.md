# ADR-0003: Replace MapLibre Map Surface With PixiJS Hex Renderer

## Status

Accepted for hard replacement implementation.

## Context

Arcanorum is replacing province polygon rendering, province map data, and province movement with a Civilization-like pointy-top hex world. Heavy mechanics remain on stable gameplay regions composed from hexes. Hexes are map and movement units for terrain, rivers, coasts, features, passability, and pathfinding.

The existing player-facing map is built on MapLibre, deck.gl, and authored province GeoJSON. That stack is strong for geospatial polygons, but it makes deterministic hex generation, edge rivers, painted coasts, wraparound rendering, and high-volume sprite batching harder than a game renderer.

## Decision

Use a PixiJS 2D renderer for the main client map entrypoint and perform a hard cutover to deterministic hex map artifacts. There is no target fallback to province polygons, authored province files, generated province indexes, or province movement graphs. The implementation renders a deterministic generated hex artifact in the existing React app:

- pointy-top axial hexes;
- X wrapping;
- terrain, biome, feature, water kind, movement cost metadata;
- edge-based rivers;
- painted coast overlays;
- stable gameplay region membership for each hex;
- hover, select, and path preview overlays.

The shared boundary introduces `HexMapArtifact` and related hex contracts. It does not introduce hex-level population, buildings, resources, taxes, or other heavy mechanics. Regions remain the heavy gameplay boundary.

## Dependency Rationale

- `pixi.js`: retained. Main renderer for canvas/WebGL batching and transformable scene layers.
- `simplex-noise`: retained. Deterministic terrain, moisture, temperature, and feature fields.
- `tinyqueue`: retained. Small A-star/open-set priority queue for hex pathfinding.
- `honeycomb-grid`: evaluated for hex coordinate helpers, but not installed because local axial helpers keep the first contract smaller.
- `@pixi/react`: not added because current latest package targets React 19 while the client uses React 18.

No external terrain asset pack is committed in this ADR. Procedural colors and marks are used until an approved licensed terrain pack is selected.

## Consequences

- MapLibre/deck province code paths are obsolete and should be removed rather than preserved as fallback.
- Region actions are resolved from selected hex to stable authored `regionId`.
- Scenario-owned saved map artifacts and generator CLI are required parts of the cutover.
- Existing province contracts are migration debt and should be removed from shared, server, client, scenario, AI, and test code as part of the replacement.
- Old saves and scenarios that depend on province maps are incompatible unless an explicit one-way migration tool converts them before validation.

## Verification Expectations

- Typecheck client/server/workspaces.
- Add generator tests for deterministic output, X-wrap neighbors, region membership, and river edge validity.
- Add validation tests that reject legacy authored province directories and generated province indexes.
- Manually test pan/zoom, hover/select, wrap boundary picking, and selection-to-region UI behavior.
