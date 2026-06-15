# World Model

Arcanorum 2 uses a Victoria-inspired two-layer world model.

## Layers

### Provinces

Provinces are lightweight geographic units. They support:

- map rendering,
- adjacency graph,
- unit movement,
- terrain/landscape,
- climate,
- movement cost,
- passability,
- coordinates and map metadata.

Provinces are not the default place for heavy simulation.

### State Regions

State regions are the main gameplay units for heavy mechanics:

- population,
- buildings,
- construction,
- resources/deposits,
- production and economy,
- taxes,
- colonization,
- diplomacy territory transfer,
- region-level modifiers.

New heavy mechanics must use `regionId` unless the user explicitly approves province-level behavior.

## Ownership

Each region has:

- `ownerCountryId`: legal owner.
- `controllerCountryId`: current controller or occupier.
- `coreCountryIds`: countries with historical/legal core status.
- `claims`: detailed claims by country.

The controller receives the economy of the region while controlling it.

## Design Consequences

- Diplomacy transfers regions, not individual provinces.
- Colonization targets whole regions.
- Province movement uses region owner/controller for access and supply.
- Countries may start with no regions.
- UI must make the distinction clear: provinces explain geography and movement; regions explain economy and politics.
