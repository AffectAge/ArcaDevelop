# ADR-0007 City Tag Effective Hex Material

## Status

Accepted

## Context

- Problem: founded cities need to affect map mechanics and visuals without moving heavy simulation from regions to hexes.
- Constraints: hexes remain lightweight map/movement units; regional economy, population, buildings, ownership, and colonization remain region-level.
- Why this matters now: settler-based colonization creates settlement projects and city markers on hexes, and building placement, movement, adjacency, and tooltips need one consistent way to understand those hexes.

## Options

- Mutate authored/generated hex `terrain` to `city`.
- Derive an effective `city` terrain replacement at every mechanic boundary.
- Keep base terrain and add a `city` tag plus data-driven modifiers.

## Decision

- Chosen option: keep base terrain and add a derived `city` tag/effective hex state.
- A hex is city-tagged when it has a settlement project or city marker in any state.
- City tag effects use the shared modifier system; city visuals use a dedicated terrain material slot.
- The map renderer may show city material for city-tagged hexes, but `HexTile.terrain` remains the authored/generated base terrain.

## Consequences

- Benefits: existing terrain rules keep working, scenario authors can target `city` explicitly, and no base terrain migration is required.
- Risks: mechanics that read raw hex terrain directly can miss city effects; new mechanics should use the effective-hex helper.
- Migration/removal work: none for existing saves in this new-game-only units/colonization slice.
- Compatibility decision: no persisted terrain mutation and no province-level heavy simulation.
- Follow-up tasks: expand modifier targeting and tooltip explanations as more unit/combat/supply mechanics become available.

## Verification

- Tests: shared effective-hex/building placement tests, server movement/building validation tests, client terrain material tests.
- Docs: world model and API/WS notes must mention city tags when contracts or authoring rules change.
- Metrics: no new runtime metrics required for this small derived-state helper.
- Review checklist: confirm no new province-level economy/population/building state was added.
