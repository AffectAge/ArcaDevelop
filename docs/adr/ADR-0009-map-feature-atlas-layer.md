# ADR-0009: Map Feature Atlas Layer

## Status

Accepted

## Context

- Problem: `HexTile.feature` was visible only through procedural colored overlay geometry, while buildings/cities use scenario-owned texture atlases with repo fallback art.
- Constraints: hexes remain lightweight map/movement units; heavy economy stays region-level; authored visuals use stable `asset:*` ids or deterministic scenario asset paths, not runtime URLs.
- Why this matters now: natural features, deposits, ruins, holy sites, passes, and strategic points need one data-driven visual layer that can support Victoria-style scenario files.

## Options

- Option A: keep procedural overlays and add more colors.
- Option B: render current hex features with texture sprites only.
- Option C: add a shared `MapFeature` visual contract with natural hex features and generated special-site instances.

## Decision

- Chosen option: Option C.
- Why: it replaces the old overlay, keeps map rendering asset-based like buildings, and creates a future-compatible scenario path without moving economy to hexes.

## Consequences

- Benefits: features are visible as art assets, scenario overrides use one stable common atlas path, each feature row can provide four same-feature texture variants, and generated special features have stable ids under `.generated/`.
- Risks: feature sprite rendering can become a map hot path if too many sprites are visible; viewport filtering and future chunk renderers should be used for larger worlds.
- Migration/removal work: remove `hexMapOverlayMeshRenderer`; generated map feature indexes can be deleted and regenerated from scenario generator files.
- Compatibility decision: no legacy overlay fallback is retained; missing scenario feature atlases use the repo-owned fallback atlas.
- Follow-up tasks: wire feature summaries into region-level resource/building rules when gameplay conversion is approved.

## Verification

- Tests: atlas resolver, generator determinism, scenario validation, and route/static serving coverage.
- Docs: update map/API/scenario authoring documentation.
- Metrics: report if map frame performance was not manually profiled.
- Review checklist: confirm no province-heavy simulation state was added.
