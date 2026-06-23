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
- Legacy province maps, province movement, and province authored data are not part of the target model.
