# Modding And Scenario Authoring

Scenario data follows a Victoria-inspired one-entity-per-file layout. Authored files use strict JSON.

## Principles

- Use stable readable IDs, for example `country:bohemia`, `region:bohemia`, `good:grain`.
- Treat each JSON `id` as authoritative. File names are human-readable only and must not become stable IDs.
- Use stable IDs for all cross-references, for example `country:bohemia`, `region:bohemia`, `province:praha`, `good:grain`.
- Keep province map/movement data in `history/provinces/*.json`.
- Keep region composition and heavy starting state in `history/regions/*.json`.
- Keep starting state in `history/`.
- Keep reusable definitions in one-file-per-entry `common/*/*.json` folders.
- Keep player-facing text in `localisation/` and Arcawiki.
- Keep balance numbers, pacing, limits, retention, and AI bonuses in `common/defines.json`.
- Keep scenario-owned files under scenario `assets/`.
- Keep generated indexes under `.generated/`; generated files are never manual source.

## Per-Entity Layout

Recommended scenario folders:

```text
scenarios/<scenario_id>/
  scenario.json
  history/
    provinces/*.json
    regions/*.json
    countries/*.json
    diplomacy/
      relations/*.json
      treaties/*.json
  common/
    defines.json
    goods/*.json
    buildings/*.json
    technologies/*.json
    laws/*.json
    cultures/*.json
    religions/*.json
    ideologies/*.json
    professions/*.json
    races/*.json
    markets/*.json
    modifiers/*.json
    ai/
      archetypes/*.json
      personalities/*.json
      strategies/*.json
  localisation/
    en.json
    ru.json
  arcawiki/
    entries/*.json
  theme/
  assets/uploads/
  .generated/
```

`map/provinces.json` and monolithic content libraries are not authored source in the target format. If runtime needs aggregate views, scenario tooling must generate them under `.generated/`.

Scenario-owned uploaded assets live under `assets/uploads/` inside the scenario folder. Server-managed URLs use `/scenario-assets/<scenario_id>/assets/uploads/<relative_path>`; global upload roots and `/uploads/...` URLs are not valid authored or runtime targets.

## Defines

`common/defines.json` is scenario-owned configuration for values that should not be hardcoded in runtime code. Use it for balance, pacing, limits, retention policies, AI bonuses, and similar tunables.

Currently supported runtime defines:

```json
{
  "ai": {
    "enabled": true,
    "maxCountriesPerTick": 50,
    "maxDecisionCandidatesPerCountry": 20,
    "contextCacheTtlTurns": 1
  },
  "economy": {
    "baseCulturePerTurn": 1,
    "baseSciencePerTurn": 1,
    "baseReligionPerTurn": 1,
    "baseConstructionPerTurn": 5,
    "baseDucatsPerTurn": 5,
    "baseGoldPerTurn": 10,
    "demolitionCostConstructionPercent": 20,
    "marketPriceSmoothing": 0.2,
    "buildingDurabilityDecayPerTurn": 10,
    "buildingDurabilityRecoveryPerTurn": 5,
    "pollutionProductivityEffectPer1000": 0.1,
    "explorationBaseEmptyChancePct": 5,
    "explorationDepletionPerAttemptPct": 7.5,
    "explorationDurationTurns": 1,
    "explorationRollsPerExpedition": 3
  },
  "auditLog": {
    "maxEntries": 1000,
    "retentionTurns": null
  },
  "colonization": {
    "maxActiveColonizations": 3,
    "pointsPerTurn": 30,
    "pointsCostPer1000Km2": 5,
    "ducatsCostPer1000Km2": 5
  },
  "customization": {
    "renameDucats": 20,
    "recolorDucats": 10,
    "flagDucats": 15,
    "crestDucats": 15,
    "provinceRenameDucats": 25
  },
  "military": {
    "militaryFormationSpeed": 10
  },
  "registration": {
    "requireAdminApproval": false
  },
  "eventLog": {
    "retentionTurns": 3
  },
  "turnTimer": {
    "enabled": true,
    "secondsPerTurn": 86400,
    "pauseWhenNoPlayersOnline": false
  }
}
```

Invalid define values and unknown define keys must fail validation or scenario application loudly. Do not add silent gameplay defaults or unused placeholder keys that hide broken scenario config.

Scenario defines are applied when a scenario is applied and become the baseline for that running game. Admin runtime settings may change the current running game after scenario application; those runtime changes are persisted as operational state and should not be edited back into scenario files unless the scenario author intentionally updates `common/defines.json`.

The machine-readable supported-field mirror lives in `.codex/project-rules.json` under `scenarioDataRules.defines`. When adding, renaming, or removing a supported define, update the TypeScript loader/validator, this documentation, tests, and `.codex/project-rules.json` together.

## Province Authoring

Province files may contain local map and movement data:

- ID and localization key,
- authored map color as `#RRGGBB`,
- terrain or landscape,
- climate,
- adjacency and movement metadata,
- passability and movement cost,
- local special sites,
- local resources or deposits.

Province files must not contain heavy simulation state:

- pops,
- buildings,
- construction,
- production, taxes, or markets,
- colonization progress,
- diplomacy transfer state.

Local resources/deposits may be province-authored, but extraction and economy remain region-level.

## Building Goods Flows

Scenario-authored buildings live in `scenarios/<scenarioId>/common/buildings/*.json`. Building `inputs`, `outputs`, and `extractions` are authored per good, so each good flow can have its own level window:

```json
{
  "inputs": [
    { "goodId": "good:grain", "amount": 5, "minLevel": 2, "maxLevel": 4 }
  ],
  "outputs": [
    { "goodId": "good:flour", "amount": 8, "minLevel": 2 }
  ],
  "extractions": [
    { "goodId": "good:ore", "amount": 10, "requiresDeposit": true, "minLevel": 3 }
  ]
}
```

`minLevel` and `maxLevel` are optional integer building levels starting at `1`. If omitted or `null`, that side of the window is unbounded. Validation rejects non-integer levels below `1` and rejects `maxLevel` lower than `minLevel`. Inactive flows do not create demand, consume inputs, report production capacity, produce goods, or extract deposits.

Legacy extraction fields (`extractionGoodId`, `extractionAmountPerTurn`, and `extractionRequiresDeposit`) remain supported for older scenario content, but new authored buildings should prefer `extractions` so every extracted good can declare its own deposit and level rules.

## Authoring Checks

Scenario authors should validate:

- duplicate IDs,
- missing references,
- missing localization,
- missing assets,
- invalid region/province membership,
- missing or invalid region/province colors,
- invalid owner/controller/core/claim country IDs,
- invalid AI profile references,
- province-heavy authored data that should be region-level,
- stale, missing, or invalid generated indexes when runtime requires generated indexes.

Validation/build tooling should fail loudly instead of silently repairing authored gameplay data.

## Arcawiki

Arcawiki should explain gameplay to players, not implementation internals.
