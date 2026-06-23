# Scenario Region History

Scenario map and region data uses strict JSON and one entity per authored file. The JSON `id` is authoritative; file names are only human-readable organization aids. See `docs/adr/ADR-0002-per-entity-scenario-files.md` and `docs/hexes-and-regions.md`.

## Hex Map Settings

Use:

```text
scenarios/<scenario_id>/map/hex-settings.json
```

Hex map settings are required after the hex map hard cutover. They define deterministic map generation and chunking parameters:

```json
{
  "seed": "bohemia-hex-map",
  "width": 160,
  "height": 96,
  "hexSize": 24,
  "seaLevel": 0.42,
  "temperature": 0.5,
  "moisture": 0.5,
  "mountains": 0.78,
  "rivers": 0.45,
  "forests": 0.55,
  "targetLandRegionSize": 24,
  "targetWaterRegionSize": 32,
  "chunkSize": 16,
  "wrapX": true
}
```

## Region Files

Use:

```text
scenarios/<scenario_id>/history/regions/*.json
```

Region files define both hex composition and scenario starting state:

```json
{
  "id": "region:bohemia",
  "nameKey": "region.bohemia.name",
  "color": "#22d3ee",
  "hexIds": ["hex:10:20", "hex:10:21"],
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
  "pops": [],
  "buildings": [],
  "construction": [],
  "resources": [],
  "infrastructure": {},
  "modifiers": []
}
```

Region files must define `color` as `#RRGGBB`. Regions are the source of truth for hex membership and region-owned resource deposits. Diplomacy territory transfer and colonization target whole regions by default.

## Removed Province Format

The target scenario format does not support legacy province authoring paths:

```text
history/provinces/*.json
common/provinceTypes/*.json
common/provinceClimates/*.json
common/provinceLandscapes/*.json
common/provinceContinents/*.json
common/provinceStrategicRegions/*.json
```

Legacy generated province indexes such as `.generated/provinces.json` are also forbidden.

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

Generated files are not authored source. They must not be manually edited, and should not be committed unless explicitly approved later. Static hex artifacts and indexes belong under `.generated/`; generated province indexes are not target runtime artifacts.

Generated scenario maps may also include:

```text
scenarios/<scenario_id>/.generated/regions.json
```

This file is produced by scenario map generation and contains generated region membership plus empty starting region state for bootstrap scenarios. It is read by the runtime together with authored `history/regions/*.json`, but it remains generated output and must not be manually edited. Authored scenario regions should still use one file per region under `history/regions/`.

## Validation

Scenario validation must reject:

- duplicate IDs,
- invalid strict JSON or schema,
- missing or invalid `map/hex-settings.json`,
- legacy province authored paths,
- generated province indexes,
- broken stable-ID references,
- regions without `hexIds`,
- invalid hex IDs in region membership,
- duplicate hex membership across regions,
- missing or invalid region `color`,
- duplicated region IDs,
- invalid owner/controller country IDs,
- invalid claim country IDs,
- pops with missing culture/religion/profession/ideology references,
- missing localization keys,
- stale or invalid generated indexes when runtime requires generated indexes.
