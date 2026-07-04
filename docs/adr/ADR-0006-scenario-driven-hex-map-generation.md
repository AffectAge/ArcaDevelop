# Scenario-Driven Hex Map Generation

## Status

Accepted

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
- Why: A destructive format change keeps authored scenario source explicit, makes stale generated data detectable, and avoids hidden gameplay fallback. The generator uses internal Voronoi/landmass data inspired by plate-style map generation, but exposes only stable hex geography, region membership, river edges, and `mapTags`.

## Consequences

- Benefits: Scenarios can choose readable scripts such as `continents`, `pangaea`, and `archipelago`; generated regions receive permanent coordinate-anchor IDs; rules can query closed, localized map tags instead of private generator internals.
- Risks: Existing local scenarios with flat `hex-settings.json` are intentionally rejected and must be rewritten. Generated region IDs may change when geography settings change.
- Migration/removal work: Old flat keys such as `seaLevel`, `temperature`, `moisture`, `mountains`, `forests`, and `wrapX: true` are invalid. Old `.generated/hex-map-artifact.json` is no longer a runtime target.
- Compatibility decision: No compatibility fallback. During active development, invalid old map settings should fail loudly.
- Follow-up tasks: Start-position selection, unique exposed continent IDs, strategic chokepoint tags, and richer island size tags remain separate mechanics.

## Verification

- Tests: Smoke generation for supported scripts, settings validation, map tag query matching, generated region integrity, and navigable river movement.
- Docs: Scenario region history, modding authoring, hex/region model, and API/static artifact docs.
- Metrics: Generated map/runtime loading must stay bounded by existing map artifact indexes and not add per-turn full-world scans.
- Review checklist: Confirm no province-heavy gameplay state, no exposed plate tags, no old format fallback, and no hidden resource/deposit generation outside scenario-owned rules.
