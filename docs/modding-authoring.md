# Modding And Scenario Authoring

Scenario data follows a Victoria-inspired one-entity-per-file layout. Authored files use strict JSON.

## Principles

- Use stable readable IDs, for example `country:bohemia`, `region:bohemia`, `good:grain`.
- Treat each JSON `id` as authoritative. File names are human-readable only and must not become stable IDs.
- Use stable IDs for all cross-references, for example `country:bohemia`, `region:bohemia`, `hex:10:20`, `good:grain`.
- Keep deterministic hex map settings in `map/hex-settings.json`.
- Keep region composition and heavy starting state in `history/regions/*.json`.
- Keep starting state in `history/`.
- Keep reusable definitions in one-file-per-entry `common/*/*.json` folders.
- Keep player-facing text in `localisation/` and Arcawiki.
- Keep balance numbers, pacing, limits, retention, and AI bonuses in `common/defines.json`.
- Keep scenario-owned files under scenario `assets/`.
- Keep generated indexes under `.generated/`; generated files are never manual source.
- Do not use root or scenario monolithic content libraries. `apps/server/data/content-library.json` is forbidden, and scenario content must be authored under `common/*/*.json`.
- Do not add compatibility aliases or legacy fallbacks for old scenario layouts, old save content fields, or old runtime state unless compatibility is explicitly approved as a separate task.
- Reference authored visuals through stable `asset:*` ids. Do not author `logoUrl`, `flagUrl`, `crestUrl`, external URLs, or direct `/scenario-assets/...` paths in scenario content.

## Per-Entity Layout

Recommended scenario folders:

```text
scenarios/<scenario_id>/
  scenario.json
  history/
    regions/*.json
    countries/*.json
    diplomacy/
      relations/*.json
      treaties/*.json
  common/
    defines.json
    assets/*.json
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

`history/provinces/*.json`, `map/provinces.json`, `.generated/provinces.json`, `apps/server/data/content-library.json`, and monolithic content libraries are not authored or runtime source in the target format. If runtime needs aggregate views, scenario tooling must generate hex artifacts under `.generated/`.

Scenario-owned uploaded assets live under `assets/uploads/` inside the scenario folder. Server-managed URLs use `/scenario-assets/<scenario_id>/assets/uploads/<relative_path>`; global upload roots and `/uploads/...` URLs are not valid authored or runtime targets.

Authored asset registry entries live in `common/assets/*.json` and point to local files under scenario `assets/`:

```json
{
  "id": "asset:good.grain",
  "type": "icon",
  "path": "assets/goods/grain.png",
  "width": 64,
  "height": 64
}
```

Content should reference these entries with fields such as `assetId`, `iconAssetId`, `flagAssetId`, `crestAssetId`, `atlasAssetId`, or `imageAssetId`. If a non-required visual is absent, the client may use repo-owned fallback atlases/icons; declared asset files must still be local, readable, and dimension-correct.

Base game resource point icons are not scenario content. Population, culture, science, religion, colonization, construction, ducats, and gold icons live as repo-owned PNG assets in `apps/client/public/game-assets/resource-icons/` and are mapped by the client. Scenarios must not define, upload, or override these icons; scenario assets remain for scenario-owned visuals such as flags, crests, backgrounds, buildings, goods, and authored art.

## Defines

`common/defines.json` is scenario-owned configuration for values that should not be hardcoded in runtime code. Use it for balance, pacing, limits, retention policies, AI bonuses, and similar tunables.

Currently supported runtime defines:

```json
{
  "ai": {
    "enabled": true,
    "maxCountriesPerTick": 50,
    "maxDecisionCandidatesPerCountry": 20,
    "contextCacheTtlTurns": 1,
    "maxBuildCompletionTurns": 8
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
    "ducatsCostPer1000Km2": 5,
    "settlementEnabled": true,
    "settlementPopulationOnCapture": 1000
  },
  "customization": {
    "renameDucats": 20,
    "recolorDucats": 10,
    "flagDucats": 15,
    "crestDucats": 15,
    "hexRenameDucats": 25
  },
  "military": {
    "militaryFormationSpeed": 10,
    "landDivisionStackLimitPerHex": 4
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

Colonization settlement defines control what happens when a colonization capture succeeds in an empty region. If `settlementEnabled` is true and `settlementPopulationOnCapture` is greater than zero, the server creates one starter region-level pop for the winner only when the captured region has no existing population. It does not add province-level population and does not add duplicate settlers to already populated regions.

The machine-readable supported-field mirror lives in `.codex/project-rules.json` under `scenarioDataRules.defines`. When adding, renaming, or removing a supported define, update the TypeScript loader/validator, this documentation, tests, and `.codex/project-rules.json` together.

## AI Colonization Profiles

AI colonization uses the same validated `COLONIZE` orders as players. Scenario AI profiles can make colonization more or less likely with the `colonization` strategy weight, and can steer first-region or frontier preference with `regionWeights`. Landless AI countries evaluate neutral colonizable regions; landed AI countries expand only to neutral regions adjacent to their owned or controlled regions.

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

Legacy extraction fields (`extractionGoodId`, `extractionAmountPerTurn`, and `extractionRequiresDeposit`) should not be used in new authored buildings. Prefer `extractions` so every extracted good can declare its own deposit and level rules.

## Building Placement And Building Atlases

New building construction requires a `targetHexId` chosen from a controlled region. Scenario-authored building definitions may add compact placement and adjacency fields:

```json
{
  "id": "building:watermill",
  "placement": {
    "allowedTerrains": ["plain", "hill"],
    "deniedWaterKinds": ["ocean"]
  },
  "adjacencyEffects": [
    {
      "id": "river_watermill_bonus",
      "when": { "adjacentToRiver": true },
      "modifier": { "target": "building.throughput", "operation": "multiply", "value": 1.1 }
    }
  ]
}
```

`placement` can allow or deny terrain, features, and water kinds. One building or construction project occupies one building slot on a hex. `adjacencyEffects` are authored on the building and currently affect building throughput from adjacent terrain, features, rivers, or neighboring building ids.

Buildings may also define military deployment capability used by `Армия -> Формирование`. This is data-driven; core code does not hardcode barracks, ports, or airbases:

```json
{
  "deployment": {
    "branches": ["land", "naval", "air"],
    "capacity": 3,
    "requiresActive": true
  }
}
```

`branches` may contain `land`, `naval`, and `air`. `capacity` is optional and counts existing units plus queued formations for the same branch on that hex. `requiresActive` defaults to true; inactive buildings do not allow deployment unless a scenario explicitly sets it to false.

Building map visuals are not authored as URL fields in building JSON. Each scenario building must provide one PNG atlas at `scenarios/<scenarioId>/assets/buildings/<sanitizedBuildingId>.png`. Sanitization replaces every character except `a-z`, `A-Z`, `0-9`, `_`, and `-` with `_`, so `building:watermill` resolves to `assets/buildings/building_watermill.png`.

The atlas must be `256x64` with four `64x64` frames from left to right: `underConstruction`, `working`, `burning`, and `ruins`. The scenario validator rejects missing, invalid, or incorrectly sized building atlases. Runtime loading failures use the client-owned fallback atlas only as a technical fallback.

Transport corridor visuals may be supplied at `assets/corridors/corridor-atlas.png`. The atlas must be `4096x1600` with `64x64` frames. Columns `0..63` are six-direction hex connection masks; rows are transport mode/status combinations in the client contract order. If a scenario does not provide this atlas, the client uses the built-in fallback corridor atlas.

City markers use the same atlas layout, but the file is derived from the culture id instead of being stored in culture JSON. Each scenario culture must provide `scenarios/<scenarioId>/assets/cities/<sanitizedCultureId>.png`; for example `culture:lantian` resolves to `assets/cities/culture_lantian.png`. The four frames are `underConstruction`, `working`, `burning`, and `ruins`. Missing, invalid, or incorrectly sized city atlases are rejected by scenario validation.

## Decision Authoring

Current decision content lives in `scenarios/<scenarioId>/common/decisions/*.json`. Scenario-authored decision `effects` must use the shared `GameEffect` slice used by events and journal lifecycle hooks. Legacy `resource_delta` is rejected in authored decision files; use `add_resource`, `spend_resource`, or `add_resource_flow` instead.

Decision availability uses the same trigger DSL as events and journal entries:

- `scope` resolves the country/region target using the same scope shape as events;
- `potential` decides whether the decision applies to the country at all;
- `allow` decides whether the visible decision can be taken right now;
- `visibleWhenUnavailable` can keep a failed `potential` decision visible as locked for player explanation.

The server returns resolved `scopes`, trigger explanations, and structured availability reasons with `code`, `labelKey`, `passed`, optional current/required values, and optional scope. Client UI must prefer these reason keys over raw fallback strings.

Decision `GameEffect` entries can add or spend resources through the ledger, trigger or schedule same-country events, update country event flags, and start, advance, complete, fail, cancel, or update variables for journal entries. Scenario validation requires referenced event ids and journal entry ids to exist.

Resource effects must use a supported country resource id (`culture`, `science`, `religion`, `colonization`, `construction`, `ducats`, or `gold`) and a positive finite `amount`. `add_resource_flow` must also provide `direction` (`income` or `expense`) and a localized ledger `labelKey`.

Decisions may also define usage limits:

- `maxUses` or `maxUsesPerCountry` limits how many times a country may take the decision;
- `maxUsesPerTarget` limits usage for each resolved target scope, such as a specific region.

The runtime stores bounded usage counters in `CountryDecisionRecord` and returns localized structured reasons when a limit is exhausted.

Decision history rows store the taken turn, legacy label, resolved scopes, bounded applied effect summaries, and explanation ids. Resource costs and resource-changing effects create explanation records with previous/new values when the runtime can inspect the country resource state. Scenario authors should keep decision ids, target scopes, resource ids, event ids, journal ids, and flag ids stable because these references are shown in player-facing history.

Decisions can also define rechargeable charges:

- `charges` sets the maximum stored charge count for the decision;
- `rechargeTurns` restores one spent charge after that many turns;
- decisions with zero available charges return the localized `charges_empty` availability reason.

Taking a charged decision spends one charge after costs and effects are applied. The turn resolver recharges country decision records once per turn from scenario-authored decision definitions.

## Event Authoring

Current event content lives in `scenarios/<scenarioId>/common/events/*.json`. Event files must use localization keys for player-facing event text and option text:

- `event.titleKey`
- `event.descriptionKey`
- `event.options[].labelKey`
- optional `event.options[].descriptionKey`
- optional `event.options[].tooltipKey`

Legacy raw option fields are invalid for authored scenario events:

- `label`
- `description`
- `buttonColor`
- `autoChancePct`

Use `buttonTone` with `default`, `primary`, `danger`, or `warning` instead of raw button colors. Event option effects use the first shared `GameEffect` slice:

```json
{
  "type": "add_resource",
  "resource": "science",
  "amount": 10,
  "labelKey": "resourceLedger.source.generic"
}
```

Supported event resource effects are `add_resource`, `spend_resource`, and `add_resource_flow`. Country resource effects are applied through the resource ledger when runtime ledger hooks are available.

Supported event-control effects are:

- `trigger_event`, which immediately creates a pending event for the same country;
- `schedule_event`, which stores a future event in `countryScheduledEventsByCountryId`;
- `cancel_event`, which removes pending and scheduled events with the referenced event id for the same country;
- `set_event_flag`, which writes a country-scoped event flag value;
- `clear_event_flag`, which removes a country-scoped event flag.

Supported modifier effects are:

- `add_modifier`, which applies a country-scoped modifier from `common/modifiers/*.json`; optional `durationTurns` makes it temporary, and omitted duration makes it permanent until removed;
- `extend_modifier`, which extends an active modifier by positive `durationTurns`, or creates it if it is not active;
- `remove_modifier`, which removes active instances of the referenced modifier from the country.

Supported region colonization effects are:

- `change_colonization_progress`, which changes the current country's progress in the resolved region scope by `amount`. It requires a resolved `region` scope and writes `WorldBase.colonyProgressByRegion`.

Runtime stores applied modifier state in `WorldBase.countryModifiersByCountryId`. Scenario validation requires referenced event ids in event-control effects and referenced modifier ids in modifier effects to exist. Population effects, politics effects, and diplomacy effects are target architecture items and should not be hardcoded in scenario-specific core branches.

Event options may define `aiWeight` rules for automatic timeout resolution. If any option has `aiWeight`, the server scores options and chooses the highest score; otherwise it falls back to `defaultOptionId`, `playerDefault`, then the first option.

```json
{
  "id": "pay_debt",
  "labelKey": "events.example.option.payDebt",
  "aiWeight": [
    { "base": 5 },
    {
      "if": { "type": "country_resource_above", "resource": "ducats", "value": 100 },
      "add": 25
    }
  ]
}
```

Events may use the first data-driven trigger DSL through `event.trigger`. Supported predicates are:

- legacy country predicates: `always`, `country_is`, `law_active`, `technology_researched`, `has_building`;
- country law/technology/modifier aliases: `country_has_law`, `country_lacks_law`, `country_has_technology`, `country_lacks_technology`, `country_has_modifier`;
- country resource predicates: `country_resource_above`, `country_resource_below`, `treasury_below`;
- country ledger predicates: `resource_flow_negative` checks the latest resource ledger turn for a country/resource net below zero;
- country region-count predicates: `country_controls_region_count_above`, `country_controls_region_count_below`;
- territorial predicates: `controls_foreign_region` passes when a country controls at least one region with a different legal owner;
- scoped region predicates: `region_owner_is`, `region_controller_is`, `region_is_colonizable`, `region_population_above`, `region_population_below`, `region_has_population_above`, `region_has_population_below`, `region_has_building`, `region_has_resource_deposit`, `region_radicals_above`, `region_loyalists_above`, `region_standard_of_living_below`, `region_colonization_progress_above`, `region_colonization_progress_below`;
- scoped building economy predicates: `building_profit_below` and `building_employment_below` evaluate the worst matching building in the resolved region. `building_profit_below` uses `lastNetDucats`; `building_employment_below` uses `lastLaborCoverage` as a `0..1` labor coverage ratio. `building_output_above` evaluates the highest `lastProductionByGoodId[targetId]` in the resolved region and validates `targetId` against `common/goods`.
- composition predicates: `all`, `any`, and `not`.

For `country_has_modifier`, `targetId` must reference a scenario-authored modifier entity id from `common/modifiers/*.json`. Law, technology, building, and resource-deposit triggers validate `targetId` against `common/laws`, `common/technologies`, `common/buildings`, and `common/goods` respectively.

Events may also resolve a region scope before trigger evaluation:

```json
{
  "scope": {
    "root": { "kind": "country" },
    "region": {
      "kind": "region",
      "from": "root.controlled_regions",
      "where": { "type": "region_population_above", "value": 1000 },
      "pick": { "orderBy": "population", "direction": "desc" }
    }
  },
  "trigger": {
    "all": [
      { "type": "country_resource_above", "resource": "ducats", "value": 25 },
      { "type": "region_has_building", "targetId": "building:university" }
    ]
  }
}
```

The server stores resolved event scopes and trigger explanation rows on pending country events. Player-facing event UI must expose these explanations so event visibility is inspectable rather than hidden in server logic.

Events may declare `timeoutTurns` and `defaultOptionId`. When `timeoutTurns` is omitted or `null`, the event stays pending until a player chooses an option. When it is present, the server sets `expiresTurnId` on the pending event and may auto-resolve it at or after that turn using `defaultOptionId`, then `playerDefault`, then the first valid option.

Events may declare `chain` followups:

```json
{
  "chain": {
    "chainId": "chain:industrial_unrest",
    "stepId": "start",
    "startsChain": true,
    "followups": [
      {
        "eventId": "event:industrial_unrest_followup",
        "delayTurns": 2,
        "chancePct": 75,
        "conditions": { "type": "country_resource_above", "resource": "ducats", "value": 10 }
      }
    ]
  }
}
```

Followups are stored in `WorldBase.countryScheduledEventsByCountryId` until their `scheduledTurnId`, then promoted into normal pending country events with the resolved scopes from the source event. Scenario validation requires followup `eventId` values to reference existing event entries.

Event resolution history is stored in `CountryEventRecord.history`. Each history row stores:

- `eventId`, `optionId`, and `resolvedTurnId`;
- localization keys for the event title and chosen option when available;
- resolved `scopes` from the pending event;
- bounded `appliedEffects` summaries with effect type and key resource/event/journal/flag references;
- `explanationIds` pointing to structured `WorldBase.explanationRecordsByTurn` rows when the runtime can explain the applied effects.

History rows are player-visible in the event history UI, so scenario-authored event and option text must remain localized and effect references must stay stable.

Manual event option resource effects create structured explanation records. Each record stores the turn, source event id, option cause, affected country, resource value key, previous value, and new value. Resource effects should therefore keep stable resource ids and label keys so history and future tooltips can explain the outcome.

Scenario validation rejects legacy raw event text and styling fields. Event definitions must explicitly set `category`, `priority`, and `visibility`, and must use `titleKey` and `descriptionKey`, not raw `title` or `description`; options must use `labelKey`, optional `descriptionKey`, optional `tooltipKey`, and `buttonTone`, not raw `label`, raw `description`, `buttonColor`, or `autoChancePct`.

## Journal Entry Authoring

Scenario-authored journal entries live in `scenarios/<scenarioId>/common/journal_entries/*.json`.

Each journal file has a stable top-level `id` and a `journalEntry` object. Required player-facing text uses localization keys:

- `journalEntry.titleKey`
- `journalEntry.descriptionKey`
- optional `journalEntry.shortDescriptionKey`
- optional `journalEntry.progress.labelKey`

The first implemented lifecycle slice supports country entries with optional resolved region scope. Journal entries may define:

- `startTrigger`, `completeTrigger`, `failTrigger`, and `cancelTrigger` using the same trigger DSL as events;
- `scope` using the same country/region event scope shape;
- `timeoutTurns`, which fails an active journal entry when the expiration turn is reached;
- `repeatable` and `cooldownTurns`;
- lifecycle effect arrays: `onStartEffects`, `onCompleteEffects`, `onFailEffects`, `onCancelEffects`;
- lifecycle event hooks in `events.onStart`, `events.onComplete`, `events.onFail`, and `events.onCancel`.

Example:

```json
{
  "id": "journal:industrialize_capital",
  "nameKey": "journal.industrialize_capital.name",
  "journalEntry": {
    "category": "economy",
    "titleKey": "journal.industrialize_capital.title",
    "descriptionKey": "journal.industrialize_capital.description",
    "priority": "high",
    "visibility": "private",
    "scope": {
      "region": {
        "kind": "region",
        "from": "root.controlled_regions",
        "where": { "type": "region_population_above", "value": 1000 },
        "pick": { "orderBy": "population", "direction": "desc" }
      }
    },
    "startTrigger": { "type": "country_resource_above", "resource": "ducats", "value": 25 },
    "completeTrigger": { "type": "region_has_building", "targetId": "building:factory" },
    "timeoutTurns": 12,
    "onCompleteEffects": [
      { "type": "add_resource", "resource": "science", "amount": 10, "labelKey": "resourceLedger.source.generic" }
    ],
    "events": {
      "onComplete": ["event:industrial_success"]
    }
  }
}
```

Runtime stores active and historical state in `WorldBase.journalEntriesByCountryId`. Lifecycle effects use the shared `GameEffect` slice; resource effects go through the resource ledger when runtime ledger hooks are available, event hooks/effects use the country event pipeline, and modifier effects update `WorldBase.countryModifiersByCountryId`.

Events and journal lifecycle hooks may also use journal-control `GameEffect` entries:

- `start_journal_entry`;
- `advance_journal_entry`;
- `complete_journal_entry`;
- `fail_journal_entry`;
- `cancel_journal_entry`;
- `set_journal_variable`;
- `clear_journal_variable`.

Scenario validation requires `journalEntryId` references in these effects to point to existing journal entries. Manual event choices apply journal effects immediately and include journal state in the broadcast world delta.

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
## Resource Ledger Defines

Scenario defines may include `resourceLedger.retentionTurns` and `resourceLedger.maxEntriesPerTurn`. Retention controls how many recent turns of country resource flow history are persisted for explanations; max entries bounds one turn's ledger size. Invalid values fail scenario validation.

Scenario-authored mechanics and content that produce country resource income or expenses should be designed around ledger categories and localized source labels rather than hidden direct balance changes.

## Military Equipment Frames

Scenario military equipment is authored as a chain:

- `equipment_classes.json`: broad class and tactical roles, such as infantry kit, field vehicle, aircraft, or warship.
- `equipment_frames.json`: concrete base chassis/airframe/hull/frame for a class. A frame defines branch, module slot ids, base stats, goods cost, optional crew manpower, optional production cost, era, and unlock metadata.
- `equipment_modules.json`: modules that fill frame slots and add stats, goods cost, crew manpower, or production cost.

If a scenario omits `equipment_frames.json`, runtime creates a basic frame for each equipment class so older class/module content remains loadable during the new-game-only military transition. New authored scenarios should provide frames explicitly.
