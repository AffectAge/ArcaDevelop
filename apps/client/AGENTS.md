# Client guide

Always start from root `AGENTS.md` and `docs/README.md`.

Read root `AGENTS.md`. For client work also read `docs/accessibility.md`, `docs/localization.md`, `docs/theme-system.md`, `docs/api-ws-versioning.md`, `docs/performance-budgets.md`, and `apps/client/src/components/templates/DEMO_ELEMENTS.md`.

## UI

- Reuse exports from `components/templates`; do not recreate the removed `components/ui` layer.
- Visible strings require English and Russian localization keys. Map stable server error codes to safe localized text.
- Use scenario theme variables for colors, typography, spacing, radii, shadows, z-index, and motion.
- New mechanics and visible values need player UI and explanatory tooltips. Ledger flows use localized `labelKey`; raw IDs are debug/admin-only.
- Important actions need localized, consequence-aware confirmation.
- Prefer semantic HTML and native controls. Preserve keyboard use, focus management, contrast, non-color meaning, reduced motion, icon labels, and at least 44-by-44 touch targets.
- Design portrait-first with safe areas, then verify desktop. HUD must protect the playfield and avoid overlapping critical controls.

When adding a reusable template, export it from `components/templates/index.ts`, document it in `DEMO_ELEMENTS.md`, and add it to the demo gallery when visually selectable.

## Phaser map

- Use the `arcanorum-map-change` skill.
- Keep simulation/server state outside Phaser scenes; scenes render normalized snapshots and emit user intents.
- Preserve pointy-top rectangular offset geometry and shared hit-testing helpers.
- Terrain is bitmap atlas art; objects, cities, units, rivers, and borders are normal Phaser layers/sprites. No custom shader pipelines or custom mesh terrain.
- Each terrain type uses one authored lossless bitmap frame. Do not generate mirrored, randomized, quilted, or coordinate-field variants unless a later architecture decision explicitly replaces the single-frame approach. Adjacent pointy-top hex masks must still cover the map without background seams inside or across chunks.
- Rivers use reproducible textured water-and-bank atlas frames; mountains, forests, cities, and other features stay separate bitmap overlays.
- Stream and display only bounded resident/visible chunks. Country/region/controller edges come from cached six-bit masks and atlases.
- Keep overlays bounded, avoid pan/zoom main-thread stalls, and report unmeasured large-map performance.

## World model

Heavy mechanics are region-facing. Hex/province UI is appropriate for terrain, movement, adjacency, passability, hover, and selection; it must not imply province-level population/economy/buildings without approval.

Arcawiki is player-facing. Update it when a mechanic or UI concept changes player understanding.
