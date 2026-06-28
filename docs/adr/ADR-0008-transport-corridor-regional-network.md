# ADR-0008: Transport Corridors as Regional Infrastructure Networks

## Status

Accepted

## Context

Transport corridors v1 stored authored hex routes directly and treated corridor access as a hex-to-hex logistics problem. This did not match the region-first world model: buildings, production, construction, resources, and market access are region mechanics, while provinces/hexes are map and movement units.

The v2 design makes corridors regional infrastructure. A corridor route still renders and validates over map hexes, but gameplay access is granted through city nodes: if an active route connects a city marker or active settlement project in a state region, that whole region can use the corridor.

## Decision

- A v2 corridor stores `schemaVersion: 2`, authored `waypoints`, server `computedHexIds`, `connectedRegionIds`, `connectedCityMarkerIds`, `transportMode`, `ownerCountryId`, `level`, `pendingLevel`, `status`, construction progress/cost, load/capacity history, and route cost.
- `POST /markets/:marketId/corridors/preview` returns the server-computed route, construction cost, connected regions, connected city nodes, and validation errors.
- `POST /markets/:marketId/corridors` accepts `waypoints` and `transportMode`; it does not trust client `hexIds`.
- Route endpoints must be city nodes. Intermediate waypoints may be any valid hex allowed by the selected transport mode.
- Market building purchases resolve corridor access through regional city endpoints when an active corridor connects the buyer/seller region.
- Corridor upgrade is a construction project. `level` changes only when construction completes; the target is stored as `pendingLevel`.
- v1 corridors are discarded during persisted restore/runtime normalization because their hex-only shape cannot reliably infer city-node regional access.

## Consequences

- Server route calculation is authoritative and repeatable between preview and creation.
- UI can show accurate preview cost and connected regions before confirmation.
- Old saves lose v1 corridor records. This is intentional for incompatible data and should be noted in release notes if saves are migrated.
- Future station, port, airport, hub, and special infrastructure nodes can be added as additional node resolvers without moving buildings to province-level mechanics.

## Risks And Mitigations

- Risk: map preview and server route differ. Mitigation: client preview is advisory; server preview/create response is the displayed source of truth.
- Risk: route finding becomes hot-path. Mitigation: routing runs on explicit preview/create/upgrade actions, not every market tick.
- Risk: sparse scenarios lack city markers. Mitigation: active settlement projects also count as city nodes; scenario validation should later warn when markets have no city nodes.
