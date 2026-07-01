# Libraries And Dependencies

New dependencies require approval and rationale.

## Current Library Map

- React/Vite/TypeScript: client runtime and build.
- Zustand: client state.
- Tailwind/CSS: styling.
- PixiJS/simplex-noise/tinyqueue/flatbush: prototype player-facing hex map rendering, deterministic terrain fields, hex pathfinding queues, and static spatial indexing for viewport culling. See `docs/dependency-hex-map-pixi.md`.
- ECharts: charts.
- Zod/react-hook-form: forms and validation.
- Express/WS: HTTP and WebSocket server.
- Prisma/SQLite: persistence.
- Redis/ioredis: optional presence, rate-limit, pubsub, planning cache.
- Sharp/image-size/multer: image processing and uploads.
- json-rules-engine: rules where explicitly useful.

## Approved Dependency Notes

- `flatbush`: client-side static 2D spatial index for the authored hex map. It replaces full-tile scans in viewport culling with bounding-box queries over a map-built-once index. Existing Pixi and map helpers do not provide this data structure, and the map tiles are static enough for Flatbush's immutable index model. Runtime cost is limited to a small client bundle dependency and one index build when `mapArtifact` changes; removal cost is low because usage is isolated behind `buildTileSpatialIndex` and viewport culling helpers.

## Approval Checklist

Before adding a dependency, document:

- what problem it solves,
- why existing libraries are insufficient,
- runtime/bundle cost,
- maintenance status,
- license,
- security/audit status,
- SSR/browser/server compatibility,
- removal cost if it fails.

## Prohibitions

- Do not add overlapping libraries casually.
- Do not use third-party runtime services without explicit permission.
- Do not add abandoned or huge libraries without strong justification.
