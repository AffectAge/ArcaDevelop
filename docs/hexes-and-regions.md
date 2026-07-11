# Hexes And Regions

Arcanorum's target map model is a hard replacement of the legacy province model. Hexes are the only map and movement units, and regions are the heavy gameplay units composed from hexes.

## Hard Cutover Policy

The hex map migration is intentionally destructive:

- legacy province maps are not supported by the target runtime,
- legacy authored `history/provinces/*.json` data is not supported by the target scenario format,
- legacy generated province indexes are not supported by the target scenario format,
- fallback rendering or movement through province polygons is not part of the target design,
- old saves and scenarios must be migrated by explicit tooling or rejected by validation.

Implementation work may temporarily touch old files while deleting or replacing them, but new behavior must not add province compatibility paths.

## Hex Responsibilities

Hex data stays lightweight and map-focused:

- `id`, using `hex:<q>:<r>`,
- axial coordinates,
- chunk membership,
- region membership,
- terrain,
- biome,
- feature,
- water kind,
- elevation,
- moisture,
- temperature,
- temperature band,
- moisture band,
- distance to water,
- coastal flag,
- localized static `mapTags`,
- compact river mask and river width,
- movement cost,
- passability,
- river edge records,
- coast overlay records,
- optional rendering metadata.

Hexes are valid targets for unit placement, pathfinding, hover, selection, movement previews, and terrain inspection.

Hexes must not own population, buildings, construction, production, taxes, diplomacy-transfer state, colonization progress, or region modifiers.

## Region Responsibilities

Regions are stable gameplay entities composed from hexes. A region owns heavy mechanics:

- authored map color,
- owner and controller,
- cores and claims,
- population,
- buildings,
- construction,
- resources and deposits,
- infrastructure,
- modifiers,
- colonization,
- economic output,
- taxes,
- diplomacy territory transfer.

The controller receives the region economy while controlling it. Diplomacy transfers whole regions. Colonization targets whole regions.

## Identifier Policy

Use stable authored region IDs for authored gameplay regions and coordinate IDs for generated geography:

- `HexId`: `hex:<q>:<r>`,
- `HexChunkId`: `hex-chunk:<q>:<r>`,
- authored `RegionId`: `region:<stable_name>`,
- generated `RegionId`: `region:hex_<anchor_q>_<anchor_r>`.

Generated region IDs must be based on anchor coordinates, not transient cluster counters. Authored regions should still use stable readable IDs across saves, localization, diplomacy, AI strategy, and scenario diffs.

## Map Tags And River Edges

`HexTile.mapTags` is the public geography vocabulary for scenario rules and player inspection. Tags use a closed `namespace:value` format with localization keys `mapTag.<namespace>.<value>`. Current namespaces cover fertility, rainfall, slope, latitude, elevation, landmass, continent role, river basin, river class, and coast state.

Scenario rules can query tags through the object DSL with `all`, `any`, and `not`. This DSL is valid for deposits, map feature generators, building placement, adjacency checks, and feature visual rules.

Rivers are edge properties, not water hexes. River edges may include `riverClass`, `navigable`, and `crossingCost`; adjacent hexes expose matching public tags such as `river:major` and `river:navigable` for tooltips and scenario tag queries. Naval units may move along navigable river edges even when the destination hex is land; land and civilian units pay the fixed crossing penalty when crossing a major navigable river edge.

## Selection And UI

Player-facing map UI should make the layers explicit:

- hex hover explains terrain, biome, passability, movement cost, and associated region,
- hex hover shows the full localized map tag list,
- movement actions target hexes,
- economy, diplomacy, colonization, construction, population, and resource actions target regions,
- region overlays aggregate hex shapes while preserving region-level actions,
- all visible text uses localization keys with English and Russian values.

## Runtime And Performance

The runtime should derive bounded indexes at scenario load:

- hex by ID,
- hexes by chunk,
- hexes by region,
- region by hex,
- passable neighbors by hex,
- movement cost by hex,
- region adjacency derived from neighboring hexes.

Static hex artifacts should be chunked and cached. World deltas should carry dynamic gameplay state, not resend static map tiles every turn.
