# Arcanorum Map Art Sources

This folder owns reproducible source specifications for the repo-owned fallback map art.

- `palette.json` is the canonical illuminated-atlas terrain palette used by the texture generator.
- `provenance.json` records origin, licensing, and generated runtime outputs.
- `hex-terrain-detail.png` uses the explicit `normal.xy-ao-detail` RGBA contract: R/G store tangent-space normal X/Y remapped to `[0,1]`, B stores ambient occlusion (`1` is open), and A stores signed micro-detail remapped to `[0,1]`.
- Runtime PNG atlases are generated under `apps/client/public/game-assets/`; they are not edited by hand.
- `natural-choice-*-4x4.png` is a project-owned 4×4, sixteen-frame, alpha-only source grid. The build selects and normalizes sixteen individual trees, shrubs, rocks, reeds, snow forms, or other objects for each terrain-oriented atlas. Frames never contain terrain, soil, grass plate, water plane, or a contact-shadow base; `npm run map-assets:build` produces the `phaser/natural_features/*.webp` sheets. `mountain_features.webp` is deliberately separate from `highland_features.webp`: the first is for large mountain massifs and ridges, the second for smaller outcrops and rough ground. `glacial_mountain_features.webp` is a third, dedicated atlas for ice and glacier overlays on `ecoregion:glacial_mountains` peaks.
- `terrain-choice-*-surface-4x4.png` is a 4×4 source selection grid of opaque terrain materials for one terrain family, including deep water, coastal water, and fresh water. Run `npm run map-assets:terrain-choices` to produce the matching `terrain-choice-*-hexes-4x4.png` atlas: sixteen lossless 112×128 pointy-top hex frames with transparent corners. These are ready-to-select terrain frames, but are deliberately not randomized or loaded by the main runtime terrain atlas; one chosen frame remains canonical for each terrain type.
- The three `*-mask-template.png` files generated beside the runtime atlases are authoring references only; the provenance manifest lists them separately and the client does not load them.
- Scenario-authored or uploaded assets do not belong here.

Run `npm run map-assets:build` after changing these sources. The build is deterministic and uses project scripts plus the existing Sharp dependency.
