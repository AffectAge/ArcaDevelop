# ADR-0003: Region-First Heavy Mechanics Without Compatibility Layer

## Status

Accepted

## Context

Arcanorum rules define provinces as lightweight map and movement units. Heavy mechanics such as population, buildings, construction, resources, production, taxes, colonization, diplomacy territory transfer, and regional modifiers belong to state regions.

The existing implementation still exposes province-owned heavy state in shared contracts, server runtime, deltas, persistence restore, and client UI. Keeping compatibility fields would preserve the wrong ownership model and let new code continue to depend on province-heavy mechanics.

## Decision

Remove province-owned heavy mechanic state without a compatibility layer.

The target world state owns heavy mechanics by `regionId`:

- `regionPopulationByRegion`
- `regionBuildingsByRegion`
- `regionPopulationTreasuryByRegion`
- `regionConstructionQueueByRegion`

Province-owned state remains valid only for province map, movement, terrain, climate, passability, movement cost, local deposits/resources, resource exploration, and unit location.

Heavy actions must target `regionId`. Province IDs may still appear in movement, map rendering, and lightweight local metadata.

## Consequences

- Old province-heavy saved state and scenario setup files are not supported.
- Scenario validation must reject province-heavy authored data.
- API/WS/delta contracts must use region-owned fields for heavy state.
- Client UI must present heavy mechanics at region/state level.
- Tests and guards must prevent province-heavy fields from returning.
