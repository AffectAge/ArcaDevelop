# Scenario Region History

Scenario region and province data uses strict JSON and one entity per authored file. The JSON `id` is authoritative; file names are only human-readable organization aids. See `docs/adr/ADR-0002-per-entity-scenario-files.md`.

## Province Files

Use:

```text
scenarios/<scenario_id>/history/provinces/*.json
```

Province files define lightweight map and movement data:

```json
{
  "id": "province:praha",
  "nameKey": "province.praha.name",
  "color": "#8fb9a8",
  "terrain": "terrain:plains",
  "climate": "climate:temperate",
  "passable": true,
  "movementCost": 1,
  "adjacentProvinceIds": ["province:plzen"],
  "specialSiteIds": []
}
```

Province files must define `color` as `#RRGGBB`. Province files may contain terrain, climate, passability, movement cost, adjacency metadata, and special sites. They must not contain pops, buildings, construction, resources, deposits, production, taxes, markets, colonization progress, or diplomacy transfer state.

## Region Files

Use:

```text
scenarios/<scenario_id>/history/regions/*.json
```

Region files define both region composition and scenario starting state:

```json
{
  "id": "region:bohemia",
  "nameKey": "region.bohemia.name",
  "color": "#22d3ee",
  "provinceIds": ["province:praha", "province:plzen"],
  "continent": "continent:europe",
  "strategicArea": "strategic_area:central_europe",
  "ownerCountryId": "country:bohemia",
  "controllerCountryId": "country:bohemia",
  "coreCountryIds": ["country:bohemia"],
  "claims": [
    {
      "countryId": "country:austria",
      "type": "dynastic",
      "strength": 0.45,
      "source": "scenario",
      "expiresTurn": null
    }
  ],
  "pops": [
    {
      "id": "pop:bohemia:farmers:czech",
      "size": 120000,
      "cultureId": "culture:czech",
      "religionId": "religion:catholic",
      "professionId": "profession:farmers",
      "ideologyId": "ideology:conservative",
      "standardOfLiving": 8,
      "wealth": 0,
      "radicals": 0,
      "loyalists": 0
    }
  ],
  "buildings": [],
  "construction": [],
  "resources": [
    {
      "goodId": "good:coal",
      "amount": 100,
      "discoveredTurnId": 1,
      "veinSize": "medium"
    }
  ],
  "infrastructure": {},
  "modifiers": []
}
```

Region files must define `color` as `#RRGGBB`. Regions are the source of truth for province membership and region-owned resource deposits. Diplomacy territory transfer and colonization target whole regions by default.

## Diplomacy

Global diplomatic state belongs in:

```text
history/diplomacy/relations/*.json
history/diplomacy/treaties/*.json
```

Region files store only region-specific cores and claims.

## Generated Indexes

The loader and scenario tooling may build generated lookup/index files under:

```text
scenarios/<scenario_id>/.generated/
```

Generated files are not authored source. They must not be manually edited, and should not be committed unless explicitly approved later. If an aggregate province index is needed for runtime performance, it is generated under `.generated/`, not authored as `map/provinces.json`.

## Validation

Scenario validation must reject:

- duplicate IDs,
- invalid strict JSON or schema,
- broken stable-ID references,
- missing province IDs,
- provinces not assigned to exactly one region unless an explicit future rule allows otherwise,
- missing or invalid region/province `color`,
- duplicated region IDs,
- invalid owner/controller country IDs,
- invalid claim country IDs,
- pops with missing culture/religion/profession/ideology references,
- missing localization keys,
- heavy province-level authored data unless approved,
- stale or invalid generated indexes when runtime requires generated indexes.
