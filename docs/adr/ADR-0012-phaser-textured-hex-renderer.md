# ADR-0012: Phaser Textured Hex Renderer

## Status

Accepted.

Supersedes ADR-0003 and the Pixi-specific rendering decisions in ADR-0010 and ADR-0011. It does not supersede the pointy-top rectangular map geometry or content-addressed scenario artifacts.

## Context

- The previous client map built custom Pixi meshes, shader inputs, transition masks, render schedulers, and per-layer graphics inside a multi-thousand-line React component.
- Country, controller, and region boundaries are derived and redrawn too broadly, so their cost grows with the world instead of the changed and visible area.
- The target art direction needs authored bitmap terrain on every hex plus transparent bitmap overlays for forests, hills, mountains, settlements, resources, and units.
- The user explicitly chose a hard client-renderer redesign, normal Phaser images/sprites/tilemaps, no custom shaders, and an original Civilization VII-inspired visual language.
- The server remains authoritative and the canonical geometry remains pointy-top rectangular offset: `q` in `[0, width)`, `r` in `[0, height)`, with optional horizontal wrapping only.

Phaser's standard `TilemapLayer` supports hexagonal maps, performs camera culling, and only sends visible tiles to the renderer. Phaser's specialized GPU tile layer is not selected because it does not support hexagonal maps and would recreate the shader-specific coupling this migration removes.

## Options

- Keep Pixi and replace only the terrain shader with sprites.
- Use Phaser with one sprite object per world hex and redraw border graphics every frame.
- Use Phaser standard hex tile layers for bitmap terrain and edge-mask borders, with sparse pooled sprites for objects and units.

## Decision

- Use Phaser `4.2.1` behind a thin React adapter. React owns DOM HUD, dialogs, localization, accessibility, and responsive layout; Phaser owns the canvas, camera, picking, and map visuals.
- Keep simulation, orders, path evaluation, world state, and scenario content outside Phaser scenes. Scenes consume typed snapshots and emit typed user intents.
- Preserve ADR-0011 content-addressed manifest/navigation/chunk delivery. Replace Pixi mesh transfer payloads with compact tile/chunk data; the worker remains responsible for fetch/decode, navigation, cancellation, and a bounded resident cache.
- Render each resident chunk with standard Phaser hex `TilemapLayer` instances:
  - one opaque terrain bitmap layer;
  - optional political/region fill layers;
  - independent country, controller, and region edge-mask layers;
  - river/coast bitmap edge layers where needed.
- Keep Phaser's per-tile cull disabled inside each small resident chunk because hex culling produced boundary seams in browser verification. Visibility culling happens at the whole-chunk layer using the streaming runtime's current visible chunk IDs, so hidden resident chunks do not render.
- Scale the bitmap frame independently on each axis so Phaser tile centers match the canonical `sqrt(3) * hexSize` horizontal and `1.5 * hexSize` vertical pointy-top steps. Terrain alpha reaches the full mathematical hex edge, and adjacent visible chunks may not expose background seams.
- Each terrain type owns exactly one authored bitmap frame built from the high-resolution source sheets. The build does not synthesize mirrored, quilted, random, or coordinate-field variants. The shipped terrain atlas uses maximum-quality WebP without chroma subsampling; Phaser renders ordinary bitmap tiles with no custom shader or mesh.
- Build rivers as raster frames composited from original shallow-water, current, shoreline, and bank materials. Every six-bit river mask terminates at the exact matching neighbor edge; mountains, forests, cities, and other features remain separate bitmap overlays.
- Render features, morphology, cities, buildings, resources, and units as sparse pooled Phaser images/sprites sourced from texture atlases. Do not use custom shaders, meshes, filters, or runtime procedural terrain materials.
- Encode each boundary tile as a six-bit edge mask. A 64-frame transparent bitmap atlas contains every mask combination. Static region masks are generated with map artifacts; dynamic owner/controller masks are calculated when a chunk becomes resident and invalidated only for affected chunks plus neighboring edge chunks.
- Ownership/control changes enqueue bounded dirty-chunk work. The renderer never performs a full-world boundary scan or rebuild in a frame. Nonresident chunks calculate current masks when loaded.
- Use separate near/mid/far bitmap atlas variants only when measured readability requires them. LOD changes switch whole layers/atlases, not shader branches.
- Use original project-owned art. Civilization VII is a direction reference for painterly terrain, diorama-like landmarks, saturated but readable biomes, and clear silhouettes; no Firaxis/2K textures or exact assets are copied.

## Consequences

- Benefits:
  - small tile-layer batching comes from the standard engine path while whole-chunk visibility remains explicit and measurable;
  - border cost scales with visible/dirty chunks rather than total world size;
  - authored textures are inspectable, replaceable, scenario-overridable assets;
  - React render cycles no longer own map scene objects;
  - the custom Pixi mesh/shader/material stack can be deleted.
- Risks:
  - several tile layers increase visible overdraw;
  - Phaser hex tile coordinates must be verified against the existing pointy-top offset helpers and wrap picking;
  - bitmap atlases require padding and extrusion to prevent texture bleeding;
  - a hard cutover can temporarily reduce secondary overlay parity.
- Completed migration/removal work:
  - replace `MapView` with a thin Phaser adapter and focused renderer modules;
  - replace worker mesh output with tile payloads;
  - redraw terrain and overlay atlases;
  - remove `pixi.js`, mesh/shader/material modules, Pixi caches/scheduler, generated material masks, and obsolete tests after import and parity checks (text/code removal completed; legacy binary outputs may remain until safe filesystem cleanup is available);
  - update performance tooling and documentation to Phaser metrics.
- Compatibility decision:
  - no Pixi fallback and no compatibility layer for old client render payloads;
  - server scenario/map contracts remain compatible unless a separately documented artifact-format change is required.

## Verification

- Unit tests: six-bit border masks, dirty-neighbor invalidation, pointy-top projection/picking, wrap edges, distinct terrain variants, gap-free terrain coverage, continuous river endpoints, texture-frame selection, chunk eviction, and layer LOD.
- Contract tests: manifest/navigation/chunks remain deterministic and content addressed.
- Browser tests: desktop and `390x844 @2x`, touch pan/pinch/select, mouse pan/wheel/select, context loss, theme switch, and reduced motion.
- Performance: default `57,600`, stress `200,000`, mobile p95 frame budget, bounded cache, no long full-world boundary task, and explicit visible-tile/layer counts.
- Sources:
  - [Phaser TilemapLayer API](https://docs.phaser.io/api-documentation/class/tilemaps-tilemaplayer)
  - [Phaser Render Texture guidance](https://docs.phaser.io/phaser/concepts/gameobjects/render-texture)
  - [Phaser downloads](https://phaser.io/download)
  - [Civilization VII developer map-generation notes](https://civilization.2k.com/de-DE/civ-vii/from-the-devs/map-generation/)
