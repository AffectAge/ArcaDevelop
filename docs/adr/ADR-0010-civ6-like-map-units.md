# ADR-0010: Civilization 6-Like Map Units

## Status

Accepted.

Supersedes the unit/equipment-constructor parts of ADR-0006 and removes the old division/fleet/air-wing runtime contour.

## Context

The old military model exposed division templates, equipment variants, production lines, stockpiles, and formation queues as player-facing constructors. That made the military UI and server state closer to a Hearts of Iron style system than the desired map-first Civilization 6 style.

Arcanorum still keeps heavy simulation at state-region level. Provinces/hexes remain map, movement, terrain, passability, and unit-position primitives.

## Decision

Replace the player-facing division/equipment constructor path with scenario-authored unit types and server-authoritative individual map units:

- `UnitTypeDefinition` is authored under `scenarios/<scenario_id>/common/unit_types/*.json`.
- `MapUnit` is stored in `WorldBase.unitsById`.
- `UnitTrainingQueueItem` is stored in `WorldBase.unitTrainingQueueByCountry`.
- Unit movement, attack, training completion, city founding, and disband target `MapUnit` ids.
- Scenario-owned unit textures live under `assets/units/<sanitizedUnitTypeId>.png`.
- Unit rendering uses Pixi sprites loaded through scenario atlases, with a static PNG fallback atlas only for missing textures.

The first tactical slice supports individual civilian, land, naval, and air-domain `MapUnit` records. It includes movement points, stored multi-turn routes, one combat plus one civilian unit per hex for a country, melee/ranged attack validation, `skip`, `sleep`, `wake`, `fortify`, and promotions that consume the unit action for the turn.

## Consequences

Old local dev saves with division/equipment/fleet/air-wing state are not migrated. Development reset is expected.

The old public constructor/runtime state is removed from `WorldBase`, `WorldDelta`, and order contracts:

- `divisionTemplatesByCountry`
- `divisionsById`
- `fleetsById`
- `airWingsById`
- `militaryFormationQueueByCountry`
- `equipmentVariantsById`
- `equipmentProductionLinesByCountry`
- `equipmentStockpileByCountry`
- `ARMY_MOVE`
- `EQUIPMENT_VARIANT`
- `EQUIPMENT_PRODUCTION_LINE`

New mechanics and UI use `unitsById` and `unitTrainingQueueByCountry`. Naval and future air units are normal `MapUnit` records distinguished by `UnitTypeDefinition.domain`; the old `Fleet` and `AirWing` containers are not persisted.

## Validation

Scenario validation checks `common/unit_types` as scenario content and validates unit atlas PNG dimensions as `256x64`, matching the building atlas style.
