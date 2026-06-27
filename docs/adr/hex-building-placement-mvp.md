# ADR: Hex Building Placement MVP

## Status

Accepted

## Context

- Problem: players need to see construction and completed buildings on concrete map hexes, while the simulation model keeps buildings, construction, economy, population, and resources at region scope.
- Constraints: hexes must remain lightweight map and movement units; heavy mechanics stay on regions; new construction must use the validated order pipeline; player-visible values need localized UI and tooltips.
- Why this matters now: building placement affects the shared `BUILD` order contract, world persistence shape, map rendering, AI build selection, and region-control ownership behavior.

## Options

- Option A: keep all construction region-only and render generic region markers. This avoids contract churn but does not support tactical map placement or adjacency gameplay.
- Option B: move buildings and production fully to hexes. This conflicts with the region-first world model and would increase simulation cost.
- Option C: require `targetHexId` for construction as a map slot while keeping construction queues, building instances, economy, population, resources, and production regional.

## Decision

- Chosen option: Option C.
- Why: it gives players concrete map placement and adjacency hooks without moving heavy simulation to hex scope. The server validates `targetHexId`, stores it on the regional construction project and resulting regional building instance, and uses it for map visuals, adjacency evaluation, and AI scoring.

## Consequences

- Benefits: buildings can be selected, queued, and inspected on map hexes; one building-slot per hex is enforceable; AI and players share the same validated `BUILD` pipeline.
- Risks: old saves or scenario state with buildings/projects missing `targetHexId` cannot be represented in the new placement model.
- Migration/removal work: legacy building instances and construction projects without `targetHexId` are destructively removed by runtime normalizers instead of silently assigned fallback hexes.
- Compatibility decision: new `BUILD` orders without `targetHexId` are rejected with `BUILD_TARGET_HEX_REQUIRED`.
- Follow-up tasks: expand authored adjacency effects into the full shared modifier record pipeline, add richer map tooltips, add ContentPanel editing support, and add upload/UI tooling for authored building textures.

## Verification

- Tests: shared placement evaluator tests cover terrain, water, occupancy, and adjacency throughput; server tests cover target hex persistence in construction and upgrades.
- Docs: world model, scenario authoring, API/WS versioning, error codes, testing, and definition of done describe the new contract and compatibility behavior.
- Metrics: viewport-only client placement highlighting avoids full-map overlay work during normal interaction.
- Review checklist: confirm no province-level economy/building simulation was introduced and all new UI text uses localization keys.
