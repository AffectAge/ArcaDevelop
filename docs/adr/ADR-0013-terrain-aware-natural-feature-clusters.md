# ADR-0013: Terrain-aware natural feature clusters

## Status

Superseded by [ADR-0014](ADR-0014-baked-natural-object-render-textures.md).

## Decision

Natural geography is authored and transported as closed `natural:*` and `vegetation:*` map tags. Scenario rules select a terrain-specific transparent cluster sheet and a stable weighted frame. One resident chunk-owned Phaser image represents one natural-feature hex; the frame contains an offline-composed scatter of trees, rocks, reeds, or snow rather than a single icon or runtime tree group.

The terrain bitmap remains the sole ground layer. Natural sheets contain alpha-only overlays and no soil, grass base, painted tile, or contact-shadow plate. The old special-site atlas retains ruins, cities, and buildings only.

## Consequences

- Detailed natural tags are available to future scenario rules without adding province-heavy simulation.
- The renderer remains bounded to one natural overlay per hex and can hide near-only rules at far LOD.
- Scenario validation rejects unknown tags and malformed natural visual rules; generated map artifacts must be rebuilt after tag changes.
