# ADR-0003: Replace MapLibre Map Surface With PixiJS Hex Renderer

## Status

Accepted for prototype implementation.

## Context

Arcanorum is moving from province polygon rendering toward a Civilization-like pointy-top hex world. Heavy mechanics remain on state regions. Hexes are map and movement units for terrain, rivers, coasts, features, passability, and pathfinding.

The existing player-facing map is built on MapLibre, deck.gl, and authored province GeoJSON. That stack is strong for geospatial polygons, but it makes deterministic hex generation, edge rivers, painted coasts, wraparound rendering, and high-volume sprite batching harder than a game renderer.

## Decision

Use a PixiJS 2D renderer for the main client map entrypoint. The first implementation is a deterministic generated hex artifact rendered in the existing React app:

- pointy-top axial hexes;
- X wrapping;
- terrain, biome, feature, water kind, movement cost metadata;
- edge-based rivers;
- painted coast overlays;
- generated region membership;
- hover, select, and path preview overlays.

The shared boundary introduces `HexMapArtifact` and related hex contracts. It does not introduce province-level population, buildings, resources, taxes, or other heavy mechanics.

## Dependency Rationale

- `pixi.js`: retained. Main renderer for canvas/WebGL batching and transformable scene layers.
- `simplex-noise`: retained. Deterministic terrain, moisture, temperature, and feature fields.
- `tinyqueue`: retained. Small A-star/open-set priority queue for hex pathfinding.
- `honeycomb-grid`: evaluated for hex coordinate helpers, but not installed because local axial helpers keep the first contract smaller.
- `@pixi/react`: not added because current latest package targets React 19 while the client uses React 18.

No external terrain asset pack is committed in this ADR. Procedural colors and marks are used until an approved licensed terrain pack is selected.

## Consequences

- MapLibre/deck code paths are no longer the intended player-facing map surface.
- Current region actions are bridged from selected hex to generated `regionId`.
- Scenario-owned saved map artifacts and generator CLI remain follow-up work.
- Existing province contracts still exist while gameplay screens complete their transition from authored province polygons to hex-driven map selection.

## Verification Expectations

- Typecheck client/server/workspaces.
- Add generator tests for deterministic output, X-wrap neighbors, land/water region separation, and river edge validity.
- Manually test pan/zoom, hover/select, wrap boundary picking, and selection-to-region UI behavior.
