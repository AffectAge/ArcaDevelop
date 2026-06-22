# Dependency Request: Hex Map Pixi Prototype

## Requested Packages

- `pixi.js`
- `simplex-noise`
- `tinyqueue`

## Reason

The hex map replacement needs a game renderer rather than a web-map renderer. PixiJS gives a retained scene graph, canvas/WebGL rendering, layers, and fast transforms for pan/zoom. `simplex-noise` supports deterministic generated terrain fields from scenario seed/settings. `tinyqueue` provides a small priority queue for A-star pathfinding without a large pathfinding framework.

## Alternatives Considered

- Continue with MapLibre/deck.gl: keeps GIS features, but works against edge rivers, hex picking, wrap rendering, and game-style terrain batching.
- `@pixi/react`: rejected for now because the current package targets React 19 and Arcanorum client is on React 18.
- `honeycomb-grid`: evaluated but not used in the first implementation because local axial helpers keep the shared/client boundary smaller.

## Constraints

No unlicensed terrain asset pack is committed. Visual terrain uses procedural renderer colors and marks until an approved asset pack is selected.

## Follow-Up

Remove unused map packages after all imports are migrated, or isolate them behind non-player-facing tooling if still needed for data conversion.
