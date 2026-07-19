---
name: arcanorum-map-change
description: Implement or review Arcanorum hex-map rendering, streaming, borders, terrain art, hit testing, cameras, path previews, or unit movement. Use for changes under apps/client/src/map, map-facing Phaser components, shared hex geometry/movement, server map mechanics, scenario map artifacts, or map performance work.
---

# Arcanorum map change

1. Read root `AGENTS.md`, `apps/client/AGENTS.md`, `apps/server/AGENTS.md`, `packages/shared/AGENTS.md`, `docs/regions-and-provinces.md`, and `docs/performance-budgets.md`.
2. Preserve pointy-top rectangular offset hexes, rectangular `q/r` bounds, and optional horizontal wrapping only. Trace geometry changes through projection, neighbors, edge masks, rivers, paths, culling, and hit testing.
3. Keep the server authoritative for movement legality. Keep biome appearance and object overlays in normal Phaser textures/sprites; do not introduce custom shader pipelines or custom mesh terrain.
4. Render only resident visible chunks. Build country, controller, and region borders from six-bit edge masks and shared atlases; never create one graphics object per edge or redraw all borders each frame.
5. Keep terrain, object, river, border, fill, and unit art reproducible through `npm run map-assets:build`. Record source/provenance and scenario ownership. The current terrain contract is one authored lossless bitmap frame per terrain type: do not synthesize mirrored, randomized, quilted, or coordinate-field variants. Reject background gaps between hex masks; rivers need textured water and banks with continuous neighboring endpoints.
6. Keep movement costs data-authored and fractional. Test route continuation, impassable changes, river/road costs, stacking, domain-specific zone of control, and server rejection.
7. Verify shared/client/server typecheck as applicable, focused tests, atlas generation when art changes, and a browser playtest at desktop plus `390x844` portrait. Inspect multiple zoom levels and a chunk boundary for terrain gaps and river discontinuities. Report any unmeasured frame or memory budget.

Major renderer, dependency, coordinate, protocol, or map-artifact changes require an ADR.
