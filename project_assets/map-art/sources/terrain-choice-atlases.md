# Terrain hex texture choices

Each `terrain-choice-*-surface-4x4.png` file is the full-resolution source
selection sheet. Run `npm run map-assets:terrain-choices` to build its matching
`terrain-choice-*-hexes-4x4.png` file.

Every generated file is a ready-to-load, lossless Phaser-style atlas:

- 4 columns × 4 rows = 16 frames;
- each frame is a pointy-top `112×128` terrain hex;
- the inside of each hex is opaque terrain material;
- only the corners and spaces between frames are transparent;
- atlas layout uses a 2px outer margin and 4px frame spacing.

Frame IDs are row-major: `R1C1` is frame `0`, `R1C2` is frame `1`, and
`R4C4` is frame `15`. The exact source/output paths and SHA-256 hashes are in
`terrain-choice-hexes-manifest.json`.

| Terrain family | Source sheet                                   | Ready hex atlas                              |
| -------------- | ---------------------------------------------- | -------------------------------------------- |
| Deep water     | `terrain-choice-deep-water-surface-4x4.png`    | `terrain-choice-deep-water-hexes-4x4.png`    |
| Coastal water  | `terrain-choice-coastal-water-surface-4x4.png` | `terrain-choice-coastal-water-hexes-4x4.png` |
| Fresh water    | `terrain-choice-fresh-water-surface-4x4.png`   | `terrain-choice-fresh-water-hexes-4x4.png`   |
| Grassland      | `terrain-choice-grassland-surface-4x4.png`     | `terrain-choice-grassland-hexes-4x4.png`     |
| Plains         | `terrain-choice-plains-surface-4x4.png`        | `terrain-choice-plains-hexes-4x4.png`        |
| Tropical       | `terrain-choice-tropical-surface-4x4.png`      | `terrain-choice-tropical-hexes-4x4.png`      |
| Desert         | `terrain-choice-desert-surface-4x4.png`        | `terrain-choice-desert-hexes-4x4.png`        |
| Tundra         | `terrain-choice-tundra-surface-4x4.png`        | `terrain-choice-tundra-hexes-4x4.png`        |
| Wetland        | `terrain-choice-wetland-surface-4x4.png`       | `terrain-choice-wetland-hexes-4x4.png`       |
| Snow           | `terrain-choice-snow-surface-4x4.png`          | `terrain-choice-snow-hexes-4x4.png`          |
| Highland       | `terrain-choice-highland-surface-4x4.png`      | `terrain-choice-highland-hexes-4x4.png`      |

These are selection assets. The shipped terrain renderer keeps one explicitly
chosen canonical frame for each terrain type; it does not randomly mix these
variants across the world.
