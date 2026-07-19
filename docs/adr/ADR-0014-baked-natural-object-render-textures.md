# ADR-0014: Baked natural-object RenderTextures

## Status

Accepted. Supersedes ADR-0013.

## Context

One ready-made forest or mountain image per hex was bounded but still looked like a stamped icon. Rendering a permanent Phaser sprite for every tree, rock, reed, and snow form would make visible-chunk cost scale poorly.

## Decision

Canonical hex geography emits one localized `ecoregion:*` tag in addition to detailed `natural:*` and `vegetation:*` tags. Ordinary mountains match the separate `mountain` landform recipe; `highland` is reserved for smaller rock outcrops. Each mountain hex renders exactly one dominant central massif. Every mountain peak (`elevation:peak`, currently elevation `>= 0.88`) becomes `ecoregion:glacial_mountains` and is explicitly excluded from the ordinary mountain recipe; its dedicated `glacial_mountain` recipe supplies one complete central icy massif. No generic `feature:snow` or `natural:*` tag is emitted for this biome. Flat tundra cannot receive conifer objects.

Each of the ten terrain-oriented natural sheets has exactly sixteen isolated 128×128 alpha frames. Scenario recipes under `common/natural_feature_visuals/` define tag queries, allowed frames, density-aware counts, scale, rotation, draw layer, and LOD. A stable hash of map seed, hex ID, rule, and placement selects frames and non-overlapping positions inside the hex.

Only visible chunks own natural RenderTextures. They bake one simplified layer at far/mid zoom and add a detail layer at zoom `>= 1.5`; the detail resolution is 4× on desktop and 2× on mobile. The installed Phaser 4 command-buffered `stamp → render` API is used as the equivalent of Phaser 3 batch drawing, so no natural child sprites remain after a chunk is baked. A bounded GPU reservation can decline the detail layer; hidden or evicted chunks immediately destroy their RenderTextures. Political and other unrelated world deltas never rebuild them.

## Consequences

- Forests, mountains, wetlands, and snow read as deterministic natural scatter while terrain remains the only ground layer.
- The scenario format is more expressive without changing movement or other canonical gameplay effects.
- Map diagnostics expose visible logical objects, RenderTexture layers, GPU bytes, build p95/p99, chunk creation/destruction p95, and budget fallbacks through the map host/performance surface.
- Context loss or visible-chunk eviction requires a reproducible rebake, not persistence of a GPU texture.
