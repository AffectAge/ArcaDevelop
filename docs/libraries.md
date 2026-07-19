# Libraries And Dependencies

New dependencies require approval and rationale.

## Current Library Map

- React/Vite/TypeScript: client runtime and build.
- Zustand: client state.
- Tailwind/CSS: styling.
- Phaser: player-facing textured hex rendering, camera/input handling, tile layers, sparse sprites, and visible-chunk presentation. See `docs/dependency-phaser.md`.
- simplex-noise/d3-delaunay/flatqueue/tinyqueue: deterministic terrain fields, Voronoi/Delaunay landmass generation, priority flood-fill region growth, and hex navigation queues.
- ECharts: charts.
- Zod/react-hook-form: forms and validation.
- Express/WS: HTTP and WebSocket server.
- Prisma/SQLite: persistence.
- Redis/ioredis: optional presence, rate-limit, pubsub, planning cache.
- Sharp/image-size/multer: image processing and uploads; the existing Sharp development dependency also builds deterministic project-owned map-art atlases.
- json-rules-engine: rules where explicitly useful.

## Approved Dependency Notes

- `d3-delaunay`: deterministic Delaunay/Voronoi seed ownership for scenario map generation. It keeps continent/island/climate-region seed assignment robust without hand-rolled nearest-site geometry. Runtime use is build/apply-time map generation, not per-turn simulation.
- `flatqueue`: small priority queue used for weighted region growth and coastal-water assignment. Existing queues are aimed at pathfinding or heavier indexing; this dependency keeps map-generation flood fills deterministic and isolated.
- `class-variance-authority`: typed client UI variant composition for reusable primitives such as `AppButton` and future template components. It replaces ad hoc variant class maps with a small runtime helper; existing React/Tailwind/clsx utilities do not provide typed variant contracts. Runtime and bundle cost are small, license is Apache-2.0, browser compatibility is standard ESM, and removal is low-cost because usage is isolated to UI primitives.
- `tailwind-merge`: client UI class conflict resolution for reusable primitives that accept `className` overrides. It prevents invalid duplicate Tailwind utilities when templates extend base components; existing `clsx` only concatenates classes. Runtime and bundle cost are small, license is MIT, browser compatibility is standard ESM, and removal is low-cost behind `components/templates/classNames.ts`.
- `howler`: browser audio engine for future UI sound feedback such as clicks, modal open/close, confirmation, rejection, and notifications. Native audio APIs are possible but require repeated sprite, codec, volume, mute, and fallback handling; Howler centralizes those concerns. Runtime impact is limited to the client audio service, no third-party service is used, license is MIT, and removal is isolated behind `lib/audio/uiSoundService.ts`.
- `@types/howler`: development-only TypeScript declarations for Howler because the installed runtime package does not ship declarations. It adds no browser bundle/runtime cost and can be removed if Howler begins shipping first-party types.
- `sharp` (root development dependency): deterministic offline packaging for original map palettes, packed detail/normal/AO textures, masks, transparent feature clusters, morphology decals, and a content-hash manifest. It is not loaded by the browser runtime and no new dependency was added for the map-art pipeline.
- `eslint-plugin-react-hooks` (root development dependency): official React-team ESLint rules for hook call order, dependency arrays, purity, and other recommended React constraints across `apps/client/src`. It has no browser runtime cost, supports ESLint 10/Node 18+, uses the MIT license, and is documented in `docs/dependency-eslint-react-hooks.md`.

## Removed Dependencies

- `flatbush`: removed after viewport culling moved to the generated chunk grid. The client no longer builds or retains a full-map spatial index; manifest chunk bounds and worker streaming now own viewport selection.
- `pixi.js`: removed after the client map cut over to standard Phaser tile/image/sprite layers. The obsolete custom mesh, material, shader, cache, and scheduling stack has no compatibility fallback.

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
