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
- movement cost,
- passability,
- river and coast edge metadata.

Hexes are not the place for heavy simulation.

Hexes may host one visual building placement slot. That slot is identified by `targetHexId` on a regional construction project or regional building instance; it is used for map rendering, placement validation, and adjacency evaluation only. Construction queues, building ownership records, production, resources, population, taxes, and economy remain region-level state.

Hexes may also host map units and visual settlement/city markers. A civilian colonizer, land division, fleet, settlement project marker, or city marker uses a `targetHexId`/`hexId` for map position and interaction. This address does not make the hex a population, economy, tax, or building simulation container.

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

Settler-based colonization follows the same region-first rule. A colonizer founds a `SettlementProject` on its current hex, but the project belongs to a region and completion transfers the region owner/controller. The final city marker is a visual and interaction anchor; population, resources, buildings, construction, production, taxes, and ownership remain region-level.

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
- Countries may start with no regions.
- UI must make the distinction clear: hexes explain geography and movement; regions explain economy and politics.
- Building UI must explain why a hex can or cannot receive a selected building, including occupation, region control, terrain, water, feature, and expected adjacency throughput effects.
- Legacy province maps, province movement, and province authored data are not part of the target model.
