# Libraries And Dependencies

New dependencies require approval and rationale.

## Current Library Map

- React/Vite/TypeScript: client runtime and build.
- Zustand: client state.
- Tailwind/CSS: styling.
- PixiJS/simplex-noise/d3-delaunay/flatqueue/tinyqueue/flatbush: player-facing hex map rendering, deterministic terrain fields, Voronoi/Delaunay landmass generation, priority flood-fill region growth, hex pathfinding queues, and static spatial indexing for viewport culling. See `docs/dependency-hex-map-pixi.md`.
- ECharts: charts.
- Zod/react-hook-form: forms and validation.
- Express/WS: HTTP and WebSocket server.
- Prisma/SQLite: persistence.
- Redis/ioredis: optional presence, rate-limit, pubsub, planning cache.
- Sharp/image-size/multer: image processing and uploads.
- json-rules-engine: rules where explicitly useful.

## Approved Dependency Notes

- `flatbush`: client-side static 2D spatial index for the authored hex map. It replaces full-tile scans in viewport culling with bounding-box queries over a map-built-once index. Existing Pixi and map helpers do not provide this data structure, and the map tiles are static enough for Flatbush's immutable index model. Runtime cost is limited to a small client bundle dependency and one index build when `mapArtifact` changes; removal cost is low because usage is isolated behind `buildTileSpatialIndex` and viewport culling helpers.
- `d3-delaunay`: deterministic Delaunay/Voronoi seed ownership for scenario map generation. It keeps continent/island/climate-region seed assignment robust without hand-rolled nearest-site geometry. Runtime use is build/apply-time map generation, not per-turn simulation.
- `flatqueue`: small priority queue used for weighted region growth and coastal-water assignment. Existing queues are aimed at pathfinding or heavier indexing; this dependency keeps map-generation flood fills deterministic and isolated.
- `class-variance-authority`: typed client UI variant composition for reusable primitives such as `AppButton` and future template components. It replaces ad hoc variant class maps with a small runtime helper; existing React/Tailwind/clsx utilities do not provide typed variant contracts. Runtime and bundle cost are small, license is Apache-2.0, browser compatibility is standard ESM, and removal is low-cost because usage is isolated to UI primitives.
- `tailwind-merge`: client UI class conflict resolution for reusable primitives that accept `className` overrides. It prevents invalid duplicate Tailwind utilities when templates extend base components; existing `clsx` only concatenates classes. Runtime and bundle cost are small, license is MIT, browser compatibility is standard ESM, and removal is low-cost behind `components/ui/classNames.ts`.
- `howler`: browser audio engine for future UI sound feedback such as clicks, modal open/close, confirmation, rejection, and notifications. Native audio APIs are possible but require repeated sprite, codec, volume, mute, and fallback handling; Howler centralizes those concerns. Runtime impact is limited to the client audio service, no third-party service is used, license is MIT, and removal is isolated behind `lib/audio/uiSoundService.ts`.
- `@types/howler`: development-only TypeScript declarations for Howler because the installed runtime package does not ship declarations. It adds no browser bundle/runtime cost and can be removed if Howler begins shipping first-party types.

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
