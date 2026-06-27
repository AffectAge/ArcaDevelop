# Testing Strategy

Arcanorum needs layered tests because it is an online strategy game with authoritative server logic.

## Test Layers

- Unit tests: pure domain logic, validators, utility scoring, error-code mapping.
- Integration tests: API/WS flows, persistence, scenario loading, cleanup lifecycle.
- Contract tests: shared types, world deltas, order validation, API/WS payloads.
- E2E tests: critical UI flows, auth, admin actions, map smoke, important player actions.
- Simulation tests: multi-turn mechanics, economy, AI, colonization, diplomacy, region control.
- Performance/load tests: resolver, AI ticks, WS delta/replay, map frame behavior, scenario validation.

## Required Principle

New mechanics need tests at the lowest practical layer plus at least one scenario/flow test when the behavior crosses systems.

Hex building placement needs shared pure evaluator coverage for terrain, feature, water, control, slot occupation, adjacency throughput, and structured reason output. Server tests must cover `BUILD.targetHexId` validation, queue creation, construction completion, upgrade preservation, and controller-change ownership transfer. Client tests or manual QA must cover placement mode, viewport overlays, invalid-click reasons, confirmation, and map-visible projects/buildings.

## Current Gap

The project does not yet have the full test stack. Agents must not pretend missing commands exist; add or propose them intentionally.
