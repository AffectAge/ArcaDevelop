# Libraries And Dependencies

New dependencies require approval and rationale.

## Current Library Map

- React/Vite/TypeScript: client runtime and build.
- Zustand: client state.
- Tailwind/CSS: styling.
- PixiJS/simplex-noise/tinyqueue: prototype player-facing hex map rendering, deterministic terrain fields, and hex pathfinding queues. See `docs/dependency-hex-map-pixi.md`.
- ECharts: charts.
- Zod/react-hook-form: forms and validation.
- Express/WS: HTTP and WebSocket server.
- Prisma/SQLite: persistence.
- Redis/ioredis: optional presence, rate-limit, pubsub, planning cache.
- Sharp/image-size/multer: image processing and uploads.
- json-rules-engine: rules where explicitly useful.

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
