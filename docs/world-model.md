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

Hexes may also host map units and visual settlement/city markers. A civilian colonizer, land division, fleet, settlement project marker, or city marker uses a `targetHexId`/`hexId` for map position and interaction. Civilian units, land divisions, and fleets can store a long-route `targetHexId`; the server recalculates routes from the current hex during turn resolution instead of trusting a stale client path. This address does not make the hex a population, economy, tax, or building simulation container.

Land divisions, fleets, and air wings have separate world-state containers: `divisionsById`, `fleetsById`, and `airWingsById`. Land divisions are the first fully interactive combat/movement slice. Fleets now have water-only long-route movement; fleet combat/repair and air-wing missions remain later slices. Fleet and air-wing containers are used by formation completion, persistence, deletion lifecycle, WS deltas, equipment planning, and UI so naval/air units do not reuse land divisions as a placeholder.

Military units can interact with civilian map units at the hex layer. A foreign civilian unit on a hex entered by a land division is captured by that division's country, clears its active route, and remains visible as a captured civilian unit in country/unit state. This is a unit-control rule only; it does not create province-level population, economy, or ownership state.

Land divisions can also attack adjacent enemy-controlled or enemy-occupied hexes through unit orders. Combat uses hex position, adjacency, and unit state, while territorial ownership, population, production, construction, and economy remain region-level systems.

Land division stacking on a hex is bounded by the scenario setting `military.landDivisionStackLimitPerHex`. The server applies this limit to peaceful movement, stored long-route advancement, and completed formation output; hostile movement still resolves through combat first.

Division templates may define equipment requirements by equipment class and tactical role. The server scores available country/scenario equipment variants from the country stockpile, physically moves assigned equipment into each division's `equipmentByVariantId` loadout, calculates equipment coverage, and scales division effective combat stats when equipment is short. The template keeps its authored/base stats; each division stores effective `stats`, `equipmentCoverage`, `equipmentByVariantId`, explanatory `equipmentAssignments`, and the latest `equipmentSupplyReport` for map and army UI inspection. Equipment that is no longer needed by a refreshed template is returned from the division loadout to the country stockpile.

Equipment variants are built from an authored frame and selected modules. A frame represents a chassis, airframe, hull, or other base; modules add stats, goods cost, crew manpower, and production cost. When a requirement is filled by a mix of variants, attack, defense, breakthrough, armor, piercing, range, reliability, supply use, and fuel use use weighted contributions from the assigned mix; speed is limited by the slowest assigned variant. Missing equipment contributes no equipment stats and lowers coverage.

Division equipment replenishment uses `supplyPriority` (`high`, `normal`, `low`) before stable id ordering. High-priority divisions receive scarce replacement equipment first; low-priority divisions are filled last. This is player-visible in the army workspace and server-authoritative during every division equipment refresh.

Land combat damage also applies attrition to assigned equipment. When a division loses `strength`, the server uses the division's assignment snapshot to remove proportional losses from `equipmentByVariantId`, then refreshes that country's division `equipmentCoverage`, `equipmentAssignments`, and effective stats. If a legacy division has no loadout yet, the server falls back to the country stockpile path until the next refresh creates a physical loadout.

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
- Fleets are separate military units stored in `fleetsById`; their current movement slice allows long-route `UNIT_MOVE` over water hexes only. Fleet combat, repair, and port basing remain later slices.
- Countries may start with no regions.
- UI must make the distinction clear: hexes explain geography and movement; regions explain economy and politics.
- Building UI must explain why a hex can or cannot receive a selected building, including occupation, region control, terrain, water, feature, and expected adjacency throughput effects.
- Legacy province maps, province movement, and province authored data are not part of the target model.
