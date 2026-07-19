# Scenario Region History

Scenario map and region data uses strict JSON and one entity per authored file. The JSON `id` is authoritative; file names are only human-readable organization aids. See `docs/adr/ADR-0002-per-entity-scenario-files.md` and `docs/hexes-and-regions.md`.

## Hex Map Settings

Use:

```text
scenarios/<scenario_id>/map/hex-settings.json
```

Hex map settings are required after the hex map hard cutover. They define deterministic map generation and chunking parameters. The old flat noise settings format is invalid; scenario validation must reject keys such as `seaLevel`, `moisture`, `mountains`, `forests`, and `targetLandRegionSize`.

```json
{
  "seed": "bohemia-hex-map-v2",
  "width": 160,
  "height": 96,
  "hexSize": 24,
  "chunkSize": 16,
  "wrapX": false,
  "generation": {
    "mapScript": "continents",
    "landmasses": {
      "majorContinents": { "min": 2, "max": 4 },
      "landRatio": 0.48,
      "islandDensity": "medium"
    },
    "climate": {
      "preset": "earthlike",
      "temperature": "temperate",
      "rainfall": "balanced"
    },
    "rivers": {
      "density": "rare",
      "navigable": true,
      "crossingPenalty": 1
    },
    "regions": {
      "targetLandRegionSize": 74,
      "targetWaterRegionSize": 140
    },
    "tags": {
      "enabled": true
    }
  }
}
```

Supported `generation.mapScript` values are `continents`, `pangaea`, and `archipelago`. Generated maps remain rectangular pointy-top offset hex maps. `wrapX` is a required boolean: `false` keeps hard left/right boundaries, while `true` wraps only horizontal neighbor lookup without changing coordinate bounds or artifact shape.

Generator internals may use landmass/plate-like data, but scenario rules should use `mapTags`, not private generator fields. The closed tag vocabulary uses `namespace:value` ids such as `fertility:rich`, `rainfall:wet`, `slope:hilly`, `latitude:temperate`, `elevation:highland`, `landmass:continent`, `continent:homeland`, `basin:delta`, `river:navigable`, and `coast:coastal`. Every supported tag requires `mapTag.<namespace>.<value>` localization in English and Russian.

Generated landmass seeds use deterministic spacing attempts to reduce clustering. The generator also applies an internal plate-like uplift layer for mountain and highland structure plus a bounded erosion-like smoothing pass for extreme local slopes; these layers have no public shape parameters. Generated islands are separated from generated continents by a two-hex water buffer on the island side. Generated region growth uses seeded anchors and hard land/water and landmass boundaries only; it does not make region borders follow elevation, moisture, rivers, mountains, or biome changes. River classes use edge width, downstream connection, distance to mouth, and local slope to expose `river:major` and `river:navigable` tags.

Scenario rule filters may use object-style tag queries:

```json
{
  "all": ["fertility:rich", { "any": ["rainfall:wet", "basin:delta"] }],
  "not": ["slope:rugged"]
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
scenarios/<scenario_id>/.generated/hex-map.json
scenarios/<scenario_id>/.generated/regions.json
scenarios/<scenario_id>/.generated/hex-map-client/current.json
scenarios/<scenario_id>/.generated/hex-map-client/<artifact_version>/manifest.json
scenarios/<scenario_id>/.generated/hex-map-client/<artifact_version>/navigation.json
scenarios/<scenario_id>/.generated/hex-map-client/<artifact_version>/chunk-<q>-<r>.json
```

These files are produced by scenario map generation. `.generated/hex-map.json` is the internal server-authoritative static map artifact, and `.generated/regions.json` contains generated region membership plus empty starting region state for bootstrap scenarios. `hex-map-client/current.json` points to the active content-addressed client version; that version owns the manifest, compact navigation artifact, Windows-safe chunks, and `.gz`/`.br` variants for every navigation/chunk JSON file. They are read by the runtime together with authored `history/regions/*.json`, but remain generated output and must not be manually edited. Authored scenario regions should still use one file per region under `history/regions/`.

Applying a scenario may regenerate `.generated/hex-map.json`, `.generated/regions.json`, and the content-addressed client artifact set when map settings or static generated features change. Generated region IDs are coordinate anchored, for example `region:hex_120_44`, so they remain stable for unchanged generated geography.

Generated special map features are written to:

```text
scenarios/<scenario_id>/.generated/map-features.json
```

This file is produced from authored `common/map_feature_generators/*.json` and the deterministic hex map artifact. It stores concrete `MapFeatureInstance` rows with stable ids, `hexId`, `regionId`, category, visibility, and visual id. Client generation copies each instance into its owning primary chunk. Natural geography remains represented by `HexTile.mapTags` and visual metadata in the static tile payload.

## Validation

Scenario validation must reject:

- duplicate IDs,
- invalid strict JSON or schema,
- missing or invalid `map/hex-settings.json`,
- old flat hex settings format,
- unknown map tags or missing map tag localization,
- invalid map tag query DSL,
- stale or invalid generated map artifacts,
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
