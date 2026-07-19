# Scenario-Driven Hex Map Generation

## Status

Accepted; the `wrapX: true` prohibition is superseded by ADR-0011.

## Context

- Problem: The old hex generator was noise-first and configured through flat numeric settings, which made map shape, gameplay geography, and scenario validation hard to reason about.
- Constraints: The map remains rectangular pointy-top hexes with `q` in `[0, width)` and `r` in `[0, height)`. Heavy gameplay stays on regions. Scenario files own generated geography inputs. No backwards compatibility layer is added for old local development scenario settings.
- Why this matters now: Map geography is becoming a foundation for deposits, features, building placement, regions, movement, and player-facing tooltips.

## Options

- Option A: Keep the old noise-first generator and add more scalar knobs.
- Option B: Add a new scenario-driven landmass generator while preserving the old flat settings as fallback.
- Option C: Replace the old format with a sectioned scenario settings contract and reject stale generated artifacts.

## Decision

- Chosen option: Option C.
- Why: A destructive format change keeps authored scenario source explicit, makes stale generated data detectable, and avoids hidden gameplay fallback. The generator uses Delaunay/Voronoi landmass seeds and internal plate-like geography inspired by Civ-style map generation, but exposes only stable hex geography, region membership, river edges, and `mapTags`.
- Additional decision: `terrain`, `biome`, and `feature` are removed from the public `HexTile` surface. Civ-like concepts are represented as closed, localized tags such as `biome:plains`, `morphology:rough`, `water:coastal`, and `feature:vegetated`.
- Additional decision: coastal water and lakes within one to two hexes of land are assigned to neighboring land regions; deep `water:ocean` remains in separate water regions. Landmasses are forced away from map edges through `generation.landmasses.edgeOceanMargin`.
- Additional decision: continent and island scale is scenario-authored through `generation.landmasses.majorContinentSize` and `generation.landmasses.islandSize` target hex-count ranges. The generator caps these targets on small maps and still applies coast noise and ocean barriers.

## Consequences

- Benefits: Scenarios can choose readable scripts such as `continents`, `pangaea`, and `archipelago`; generated regions receive permanent coordinate-anchor IDs; rules can query closed, localized map tags instead of private generator internals; region ownership can include adjacent coastal waters without turning deep ocean into land gameplay space.
- Risks: Existing local scenarios with flat `hex-settings.json` are intentionally rejected and must be rewritten. Generated region IDs may change when geography settings change.
- Migration/removal work: Old flat keys such as `seaLevel`, `temperature`, `moisture`, `mountains`, and `forests` are invalid. ADR-0011 later made boolean `wrapX: true` valid while preserving the same rectangular pointy-top artifact. Generated tiles containing `terrain`, `biome`, or `feature` are invalid. Old `.generated/hex-map-artifact.json` is no longer a runtime target.
- Compatibility decision: No compatibility fallback. During active development, invalid old map settings should fail loudly.
- Follow-up tasks: Start-position selection, unique exposed continent IDs, strategic chokepoint tags, and richer island size tags remain separate mechanics.

## Verification

- Tests: Smoke generation for supported scripts, settings validation, map tag query matching, generated region integrity, and navigable river movement.
- Docs: Scenario region history, modding authoring, hex/region model, and API/static artifact docs.
- Metrics: Generated map/runtime loading must stay bounded by existing map artifact indexes and not add per-turn full-world scans.
- Review checklist: Confirm no province-heavy gameplay state, no exposed plate tags, no old format fallback, and no hidden resource/deposit generation outside scenario-owned rules.
