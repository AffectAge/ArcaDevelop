# World Model

Arcanorum 2 uses a hex-and-region world model.

## Layers

### Hexes

Hexes are lightweight geographic units. They support:

- map rendering,
- axial coordinates,
- chunk membership,
- adjacency graph,
- unit movement,
- terrain,
- biome,
- feature overlays,
- water kind,
- elevation,
- moisture,
- temperature,
- temperature band and moisture band,
- distance to water and coastal flag,
- compact river mask and river width,
- movement cost,
- passability,
- river and coast edge metadata.

Hexes are not the place for heavy simulation.

Hexes may host one visual building placement slot. That slot is identified by `targetHexId` on a regional construction project or regional building instance; it is used for map rendering, placement validation, and adjacency evaluation only. Construction queues, building ownership records, production, resources, population, taxes, and economy remain region-level state.

Hexes may also host `MapUnit` records and visual settlement/city markers. A unit uses `hexId` for current map position and may store a long-route `targetHexId`; the server validates routes and advances movement from the current hex during turn resolution instead of trusting stale client paths. This address does not make the hex a population, economy, tax, or building simulation container.

`MapUnit` is the only tactical unit model. Civilian, land, naval, and future air behavior is selected through `UnitTypeDefinition.domain` and unit stats, not through separate division/fleet/air-wing containers. The first stacking rule is Civ-like: at most one combat unit and one civilian unit for the same country on a hex.

Map units can move, attack, promote, skip, sleep, fortify, wake, and, for colonizers, found cities through server-validated immediate orders. Combat uses hex position, movement/action state, melee/ranged range, and unit stats. It updates `MapUnit` state directly; there is no division loadout, equipment stockpile, fleet, or air-wing attrition path in the active tactical model.

Settlement projects and city markers also add a derived `city` tag to their hex for map mechanics. The generated/base `terrain` remains unchanged, so a city on plains is still plains for terrain rules unless content explicitly targets the `city` tag. City-specific effects must be authored through modifiers or tag-aware placement/adjacency rules, not hardcoded province-level simulation.

### Regions

Regions are stable gameplay entities composed from hexes. Regions are the main gameplay units for heavy mechanics:

- population,
- buildings,
- construction,
- resources/deposits,
- production and economy,
- taxes,
- colonization,
- diplomacy territory transfer,
- region-level modifiers.

New heavy mechanics must use `regionId`. Do not add population, buildings, construction, resources, taxes, colonization progress, diplomacy-transfer state, or region modifiers to individual hexes.

Building placement is the narrow exception for map addressability: a building occupies one free hex slot, but the building instance still belongs to `regionBuildingsByRegion[regionId]` and its construction project still belongs to `regionConstructionQueueByRegion[regionId]`.

Resource deposits are the second narrow map-addressability exception. A deposit is a physical `good:*` occurrence on one `hexId`, stored under its owning `regionId` in `regionResourceDepositsByRegion`. Extraction buildings must target a hex with a known matching deposit, and finite deposits deplete on that hex. The building instance, construction queue, market access, ownership, warehouses, production accounting, population, and taxes remain region-level systems.

Settler-based colonization follows the same region-first rule. A colonizer founds a named `SettlementProject` on its current hex, but the project belongs to a region and completion transfers the region owner/controller. The final named city marker is a visual and interaction anchor; population, resources, buildings, construction, production, taxes, and ownership remain region-level.

Scenario startup seeds one idle civilian colonizer for each authored country. The starter unit is placed on a deterministic pseudo-random passable land hex, preferring a hex in a region controlled by that country and falling back to any passable land hex when the country has no controlled region. This uses the hex only as the unit's map address and does not create province-level ownership, population, economy, or construction state.

## Ownership

Each region has:

- `ownerCountryId`: legal owner.
- `controllerCountryId`: current controller or occupier.
- `coreCountryIds`: countries with historical/legal core status.
- `claims`: detailed claims by country.

The controller receives the economy of the region while controlling it.

## Design Consequences

- Hexes are the only target map and movement units in the target runtime.
- Diplomacy transfers regions, not individual hexes.
- Colonization targets whole regions.
- Hex movement uses region owner/controller for access and supply.
- City hexes use base terrain plus a derived city tag; mechanics that need city behavior should read effective hex state rather than mutating map terrain.
- Countries may start with no regions.
- UI must make the distinction clear: hexes explain geography and movement; regions explain economy and politics.
- Building UI must explain why a hex can or cannot receive a selected building, including occupation, region control, terrain, water, feature, and expected adjacency throughput effects.
- Legacy province maps, province movement, and province authored data are not part of the target model.
