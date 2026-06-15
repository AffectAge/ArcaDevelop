# ADR-0002: Per-Entity Scenario Files

## Status

Accepted.

## Context

Arcanorum scenarios need to be readable, moddable, reviewable, and scalable enough for large worlds. Aggregate authored files such as `map/provinces.json`, monolithic content libraries, or single diplomacy files become hard to diff, validate, merge, and clean up as scenario size grows.

The project also uses a Victoria-inspired world model:

- provinces are lightweight map and movement units,
- state regions own heavy simulation state,
- scenarios own their content, localization, AI config, Arcawiki, theme, defines, and assets.

## Decision

Scenario-authored data uses strict JSON and a one-entity-per-file layout.

The JSON `id` field is the authoritative entity ID. File names are free, human-readable organization aids and must not be used as stable IDs. Cross-references use stable IDs only, such as `country:bohemia`, `region:bohemia`, `province:praha`, and `good:grain`.

Province-authored files live in:

```text
scenarios/<scenario_id>/history/provinces/*.json
```

Region files own region composition through `provinceIds` and heavy starting state:

```text
scenarios/<scenario_id>/history/regions/*.json
```

Reusable content uses one file per entry:

```text
scenarios/<scenario_id>/common/goods/*.json
scenarios/<scenario_id>/common/buildings/*.json
scenarios/<scenario_id>/common/technologies/*.json
scenarios/<scenario_id>/common/laws/*.json
scenarios/<scenario_id>/common/cultures/*.json
scenarios/<scenario_id>/common/religions/*.json
scenarios/<scenario_id>/common/ideologies/*.json
scenarios/<scenario_id>/common/professions/*.json
scenarios/<scenario_id>/common/races/*.json
scenarios/<scenario_id>/common/markets/*.json
scenarios/<scenario_id>/common/modifiers/*.json
```

Diplomacy and AI config are also split by entity:

```text
scenarios/<scenario_id>/history/diplomacy/relations/*.json
scenarios/<scenario_id>/history/diplomacy/treaties/*.json
scenarios/<scenario_id>/common/ai/archetypes/*.json
scenarios/<scenario_id>/common/ai/personalities/*.json
scenarios/<scenario_id>/common/ai/strategies/*.json
```

Arcawiki is player-facing and per entry:

```text
scenarios/<scenario_id>/arcawiki/entries/*.json
```

The scenario loader must recursively read entity directories, validate schemas and references strictly, and build generated indexes under:

```text
scenarios/<scenario_id>/.generated/
```

`.generated/` is generated-only. It must not be manually edited or committed unless the project later explicitly approves committed generated indexes.

## Province File Boundary

Province files may contain local map and movement data:

- `id`,
- localized name key,
- terrain or landscape,
- climate,
- adjacency and movement metadata when needed,
- passability,
- movement cost,
- local special sites,
- local resources or deposits.

Province files must not contain heavy simulation state:

- pops,
- buildings,
- construction,
- production,
- taxes,
- markets,
- colonization progress,
- diplomacy transfer state.

Local resources or deposits may be province-authored, but extraction, economy, ownership effects, and production remain region-level mechanics.

## Validation Requirements

Scenario validation fails on:

- duplicate IDs across the relevant entity registry,
- invalid strict JSON,
- schema failures,
- broken stable-ID references,
- missing localization keys,
- missing region/province membership,
- province-heavy forbidden fields,
- stale, missing, or invalid generated indexes when runtime requires indexes.

The old aggregate `provinces.json` is no longer an authored source. If runtime needs an equivalent aggregate view, validation/build tooling must generate it under `.generated/`.

## Consequences

Benefits:

- smaller diffs and easier scenario review,
- clearer ownership and cleanup per entity,
- easier modding and conflict resolution,
- better validation surfaces,
- generated indexes can serve runtime performance without making aggregate files source of truth.

Costs:

- scenario loader and validator become stricter and more complex,
- existing scenarios must be converted instead of dual-loaded,
- generated-index freshness must be tracked,
- tooling must avoid silently repairing broken authored data.

## Implementation Notes

No compatibility with old authored aggregate scenario files is required after migration. Existing scenarios should be converted fully. Technical safety defaults may exist only when documented; gameplay fallbacks that mask invalid scenario data require explicit approval.
