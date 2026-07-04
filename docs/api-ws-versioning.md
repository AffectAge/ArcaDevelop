# API And WS Versioning

## Contract Rules

New API/WS contracts require:

- stable message or endpoint name,
- typed payload,
- stable error codes,
- authorization policy,
- idempotency decision,
- compatibility/removal decision,
- tests for valid and invalid payloads.

## World Deltas

World delta changes must:

- update shared types,
- update server producers,
- update client consumers,
- preserve ACK/replay semantics,
- avoid full snapshot fallback unless explicitly approved or documented as technical safety.

Current compact world-delta fields include `j` for full-list `diplomacyProposals` replacement, `s` for `countryScheduledEventsByCountryId`, `xg` for `countryEventFlagsByCountryId`, `jo` for `journalEntriesByCountryId`, and `xr` for `explanationRecordsByTurn`. Any new compact field must be documented here with its shared mask, server producer, and client consumer.

The Civ-like units/equipment contract introduces grouped mask `WORLD_DELTA_MASK.unitEquipmentState` because the current numeric bitmask is near its 32-bit limit. The grouped mask carries compact fields `cu` (`civilianUnitsById`), `fl` (`fleetsById`), `aw` (`airWingsById`), `sp` (`settlementProjectsById`), `ci` (`cityMarkersById`), `ev` (`equipmentVariantsById`), `el` (`equipmentProductionLinesByCountry`), and `es` (`equipmentStockpileByCountry`). Server producer: `apps/server/src/runtime/worldDeltaDiff.ts`. Client consumer: `apps/client/src/store/gameStore.ts`. A future protocol version can split this grouped mask into per-section masks after replacing the 32-bit mask constraint.

## Error Codes

Do not rely on raw human-readable server messages. Use machine-readable `code` values and localize UI messages on the client.

## Unit, Settlement, And Equipment Orders

The shared order union reserves player-facing target orders for the new model:

- `UNIT_MOVE`: moves a `MapUnit` with `unitKind: "map"` toward a server-validated target hex.
- `UNIT_ATTACK`: requests a manual Civ-like attack against a target hex/unit.
- `UNIT_SKIP_TURN`: spends a `MapUnit` action for the current turn only, removing it from the turn action checklist until the next turn.
- `UNIT_SLEEP`: puts a `MapUnit` into `sleeping` status so it no longer blocks turn readiness until explicitly woken or given a future wake rule.
- `UNIT_WAKE`: returns an owned sleeping `MapUnit` to `idle` through the normal validated order pipeline without granting extra movement.
- `FOUND_CITY`: consumes a `colonizer` civilian unit and starts a region-owned settlement project at the unit hex when the target region is neutral and eligible.
- `EQUIPMENT_VARIANT`: creates or updates a country/scenario equipment variant from module slots.
- `EQUIPMENT_PRODUCTION_LINE`: creates or updates a production line for a specific equipment variant.

`COLONIZE` remains a legacy/internal compatibility order while the player UI transitions away from button colonization. New player-facing colonization should use `FOUND_CITY`.

`FOUND_CITY` is validated both on order submission and during turn resolution. The server requires a trimmed city `name` from 1 to 32 characters, the referenced colonizer to belong to the order country, stand on `targetHexId`, and target a hex inside `regionId`. The region must be neutral, colonization must not be disabled, and there must be no active/stalled settlement project for that region. On acceptance during turn resolution, the colonizer is removed immediately and a named `SettlementProject` is created. Settlement progress spends colonization points through the resource ledger with `resourceLedger.source.settlement.progress`; the region owner/controller changes only when the project completes, at which point the server creates a named `CityMarker`.

Player-facing colonization UI must use colonizer units, pending `FOUND_CITY` orders, and `SettlementProject` state. The legacy `COLONIZE` order may still be present in compatibility/admin paths, but the map client should not create pending colony overlays or resource-spend forecasts from player `COLONIZE` orders.

Land division movement now accepts player-facing `UNIT_MOVE` orders with `unitKind: "division"`. Legacy `ARMY_MOVE` remains accepted as compatibility while older AI/admin flows migrate. The server stores `Division.targetHexId` for distant goals. Submit validation and turn resolution can derive a server route from the current hex graph, so the route may be longer than the division's current per-turn speed. On each turn the army resolver recalculates the route from the division's current hex to `targetHexId`, advances up to its speed, and clears the target when the route completes or becomes invalid.

`POST /military/formations` queues a formation from the selected template branch. Payload fields are `templateId`, `hexId`, optional `name`, `quantity`, `priority`, and `repeat`. Missing optional queue controls default to `quantity: 1`, `priority: "normal"`, and `repeat: false`. The server validates the deployment hex against controlled region state and scenario-authored building `deployment.branches`; client map highlighting is preview only. Completed land templates create `Division` records in `divisionsById`, naval templates create `Fleet` records in `fleetsById`, and air templates create `AirWing` records in `airWingsById`. Queue items keep `quantity`, `remainingQuantity`, `priority`, `repeat`, and optional `stalledReasonCode`. Fleet repair/combat and full air-wing basing remain follow-up route slices.

`WorldBase` includes dedicated `fleetsById` and `airWingsById` containers. They persist, restore, diff, and apply through `WORLD_DELTA_MASK.unitEquipmentState`; formation queue completion is the first server producer for those containers.

`UNIT_ATTACK` currently supports the first land-division melee slice. The attacker must be an owned land division that has not already acted this turn, and the target hex must be adjacent and contain an enemy land division or be controlled by another country. `targetUnitId`, when provided, must point to an enemy division on the target hex. Resolution uses the same server battle resolver as move-into-enemy-hex combat, consumes the division action through `movedDivisionIds`, and blocks stored route advancement for that division in the same turn. Ranged attacks, fleets, air wings, and non-adjacent targeting remain reserved for later slices.

Land division movement uses the scenario `military.landDivisionStackLimitPerHex` setting for friendly/non-hostile hexes. Submit validation can reject the first peaceful step with `DIVISION_STACK_LIMIT_REACHED`; turn resolution also stops stored routes and completed formation output when the next or spawn hex is full.

`GET /game-settings/public` includes the public `military` settings needed by map UI, including `landDivisionStackLimitPerHex`, so the selected-hex panel can explain the same stacking rule the server validates.

`Division` records may include `equipmentCoverage`, `equipmentByVariantId`, `equipmentAssignments`, and `equipmentSupplyReport` in WS snapshots and deltas. `stats` on a division are effective stats after template equipment coverage; template `stats` remain the base design stats. `equipmentByVariantId` is the persisted physical loadout currently held by the division. `equipmentAssignments` stores the current per-requirement variant assignment/explanation snapshot for that loadout. `equipmentSupplyReport` stores the latest received/returned equipment by variant for player-facing tooltips.

Land combat and division refresh can change both `equipmentStockpileByCountry` and `divisionsById` through the grouped `WORLD_DELTA_MASK.unitEquipmentState` mask plus normal division deltas. Refresh moves equipment from stockpile into division `equipmentByVariantId` and returns no-longer-needed loadout equipment to stockpile. When battle damage lowers a division's `strength`, the server removes proportional assigned equipment from the division loadout, then refreshes that country's division `equipmentCoverage`, `equipmentAssignments`, and effective `stats` in the same world update.

`DELETE /military/divisions/:divisionId` disbands an owned division. The server returns the division's `equipmentByVariantId` loadout to `equipmentStockpileByCountry`, deletes the division from `divisionsById`, persists state, and broadcasts deltas for both division state and grouped unit/equipment state. The legacy `/army/divisions/:divisionId` route is kept as a compatibility alias during the army UI migration.

`PATCH /military/divisions/:divisionId/supply-priority` updates an owned division's `supplyPriority` to `high`, `normal`, or `low`, refreshes country division equipment state, and broadcasts division/equipment deltas. This controls which divisions receive scarce equipment first. The legacy `/army/divisions/:divisionId/supply-priority` route remains as a compatibility alias.

`PATCH /military/air-wings/:airWingId/mission` updates an owned air wing's `mission` to `none`, `air_superiority`, `ground_support`, `interception`, or `naval_patrol`. Active missions require `targetRegionId`; `none` clears it. The first slice validates that the target region is known to the active world, stores the mission and target in `airWingsById`, changes status to `mission` or `idle`, persists state, and broadcasts the grouped unit/equipment delta. Combat, range, basing, and modifier effects for these missions are reserved for later air-system slices.

`GET /military/overview` includes `regionOptions` so the army workspace can assign air-wing mission targets without reading a full world snapshot. It also includes `equipmentSupplySummary`, aggregating the latest per-division `equipmentSupplyReport` for the requesting country. The summary includes the latest report turn, affected division count, received equipment by variant, and returned equipment by variant for the army workspace overview.

Turn resolution emits private `military` news when division equipment refresh changes loadouts for a country. The news summarizes affected division count and total received/returned equipment for the current turn; detailed per-variant inspection remains in `equipmentSupplySummary` and per-division `equipmentSupplyReport`.

Equipment production lines are managed through `/military/equipment/production-lines`. `POST` creates a line, `PATCH /:lineId` updates `assignedCapacity` and/or `active`, and `DELETE /:lineId` removes the line. All three operations are country-scoped, persist state, and broadcast grouped unit/equipment deltas.

Equipment variants are created through `/military/equipment/variants`. New clients should submit `frameId`, `name`, and `moduleIdsBySlotId`; the server finds the frame's equipment class, validates that every frame slot has a compatible module, and recalculates stats, goods cost, crew manpower, and production cost authoritatively. A legacy `classId` payload may resolve to that class's first frame during the transition, but player-facing UI should use `frameId`.

Division, fleet, and air-wing templates keep equipment requirements by `equipmentClassId`, tactical `role`, and `count`. The server does not pin a concrete variant by default. During equipment refresh it scores available variants, can assign multiple variants to one requirement, stores the mixed loadout in `equipmentByVariantId`, and exposes weighted `equipmentAssignments` for tooltips/debug UI.

`EquipmentProductionLine` may include `lastStatus`, `lastProduced`, and `lastMissingGoods` after turn resolution. `lastStatus` is `active`, `idle`, `stalled`, or `invalid`; `lastMissingGoods` lists required, available, and missing amounts for goods that prevented completion. The army workspace uses these fields for production-line tooltips.

Land division movement also applies the first civilian-capture slice. When a land division successfully enters a hex containing foreign non-captured civilian units, those civilian units become `captured`, clear their current route/target, and record `capturedByCountryId`. Friendly civilian units on the same hex are not captured. This currently runs inside the server military movement/battle resolver and is visible through normal `civilianUnitsById` world deltas.

## Build Order Contract

`BUILD` orders require `targetHexId` in addition to `countryId`, `regionId`, and `payload.buildingId`. The server rejects missing values with `BUILD_TARGET_HEX_REQUIRED` and validates that the target hex is in the requested region, controlled by the requester, eligible for the selected building placement rules, and not occupied by another building instance or construction project.

`RegionConstructionProject.targetHexId` and `BuildingInstance.targetHexId` are part of the persisted and delta-visible state. Upgrade and auto-upgrade projects preserve the existing instance hex. Persisted projects or instances without `targetHexId` are not migrated to invented hexes; runtime normalizers remove them as incompatible legacy state.

Building placement rules may target derived hex tags in addition to base terrain/feature/water. `placement.allowedTags` and `placement.deniedTags` currently support `city`; adjacency effects may use `when.neighborTags`. Tags are derived from world state and do not mutate the map artifact `terrain`.

Extraction buildings also validate resource deposits on `targetHexId`. `extractions` automatically require a known matching `goodId` deposit unless the extraction row explicitly sets `requiresDeposit: false`; `requiresDepositGoodIds` can declare additional explicit deposit requirements. Hidden or discoverable deposits do not satisfy construction.

`WorldBase.regionResourceDepositsByRegion` remains the WS/delta container for deposits and still uses compact field `t` under `WORLD_DELTA_MASK.regionResourceDepositsByRegion`. Its entries are now hex-anchored `MapResourceDepositInstance` records with stable `resource_deposit:*` ids, `goodId`, `hexId`, `regionId`, `amount`, `maxAmount`, `initialAmount`, `visibility`, `source`, and `depletionMode`. A new compact mask was intentionally not added because the existing container is region-keyed and already delta-visible to clients.

## Scenario Building Atlas Assets

Building visual URLs are not part of the building content contract. Clients derive authored building atlas URLs from the active scenario id and building id as `/scenario-assets/<scenarioId>/assets/buildings/<sanitizedBuildingId>.png`. `GET /game-settings/public` includes `activeScenarioId` so unauthenticated and player clients can compute scenario-owned asset paths without admin metadata access.

The server statically serves `/scenario-assets/:scenarioId/assets/buildings/*` from `scenarios/<scenarioId>/assets/buildings/`; unsafe scenario ids return 404. Scenario validation requires each building atlas to be a readable PNG sized `256x64`.

City marker visuals use the same atlas convention with culture ids. Clients derive city atlas URLs as `/scenario-assets/<scenarioId>/assets/cities/<sanitizedCultureId>.png`, and the server statically serves `/scenario-assets/:scenarioId/assets/cities/*` from `scenarios/<scenarioId>/assets/cities/`. Scenario validation requires each culture's city atlas to be a readable PNG sized `256x64`.

Feature visuals use one common scenario atlas at `/scenario-assets/<scenarioId>/assets/features/feature-atlas.png`, with a repo fallback at `/game-assets/features/fallback-feature-atlas.png`. The atlas is `384x448`: six `64x64` variants across each row, with rows assigned to current feature visual ids (`feature:forest`, `feature:dense_forest`, `feature:jungle`, `feature:marsh`, `feature:scrub`, `feature:snowcap`, `feature:ancient_ruins`). Current natural `HexTile.feature` values resolve to those visual ids; generated special features use the `visualId` stored in `.generated/map-features.json`.

Resource deposit visuals use one shared scenario atlas at `/scenario-assets/<scenarioId>/assets/resources/resource-deposit-atlas.png`, with a repo fallback at `/game-assets/resources/fallback-resource-deposit-atlas.png`. Each frame is `64x64`; columns are stock-ratio tiers and stable variants, while rows map to supported `good:*` ids. The client chooses the tier from `amount / maxAmount` and the variant from a stable hash of `goodId + hexId`.

`GET /hex-map/features` returns `{ features: MapFeatureInstance[] }` for readonly generated/special map features. This endpoint is public map metadata and does not mutate world state. Natural hex features remain in `/hex-map/artifact`.

`GET /hex-map/feature-visuals` returns `{ visuals: MapFeatureVisualRuleDefinition[] }` for scenario-authored conditional frame rules. If it returns an empty list, the client uses built-in defaults. Conditions are evaluated against `HexTile` visual metadata such as `biome`, `temperatureBand`, `moistureBand`, `distanceToWater`, `isCoastal`, and `riverMask`.

## Transport Corridor Contract

Transport corridor v2 routes are server-authoritative regional infrastructure. `POST /markets/:marketId/corridors/preview` accepts `waypoints` and `transportMode`, recalculates the route from map movement cost, validates city endpoints/build rights/transit constraints, and returns `computedHexIds`, `connectedRegionIds`, `connectedCityMarkerIds`, `routeCost`, and `costConstruction`.

`POST /markets/:marketId/corridors` uses the same payload and validation. Clients must not send or trust final `hexIds`; persisted corridors store `schemaVersion: 2`, authored `waypoints`, server `computedHexIds`, connected regions/city nodes, construction progress, capacity/load history, and optional `pendingLevel` for upgrades. Legacy v1 corridor records are removed during restore/runtime normalization because they cannot be safely mapped to region-level city-node access.

`PATCH /markets/:marketId/corridors/:corridorId` accepts `action: "open" | "close" | "upgrade" | "cancel" | "demolish"`. `cancel` deletes an owned corridor only while it is still `building`; `demolish` deletes an owned corridor only after it is no longer building. Both actions persist the market corridor state and return the updated corridor list. The current concurrency strategy is explicit rejection on stale/invalid status plus last-writer persistence in the in-memory game settings runtime.

`MarketOverviewResponse.logisticsSnapshot` includes `coverageByModeByRegion` and corridor service areas include `connectedRegionIds`/`connectedCityMarkerIds` so clients can explain regional access without scanning the world.

Scenario corridor visuals use `/scenario-assets/<scenarioId>/assets/corridors/corridor-atlas.png`, with a client-owned fallback at `/game-assets/corridors/fallback-corridor-atlas.png`. The atlas is `4096x1600`, sliced into `64x64` frames. Columns `0..63` are the six-direction hex connection bitmask for a corridor tile; rows are grouped by transport mode (`land`, `sea`, `air`, `pipeline`, `powerGrid`) and status (`planned`, `building`, `active`, `overloaded`, `closed`). This allows same-mode corridor branches, junctions, and crossings to resolve to one tile frame instead of overlapping line sprites.

## Unit Movement Orders

`UNIT_MOVE`, `UNIT_ATTACK`, `UNIT_SKIP_TURN`, `UNIT_SLEEP`, and `UNIT_WAKE` target individual `MapUnit` records with `unitKind: "map"`. The server validates ownership, current unit status, queued-order conflicts, route contiguity for movement, adjacent target legality for attacks, and sleeping-state legality for wake. The client uses `/turn/actions` to guide players toward blocking idle units, but readiness remains a UX layer: force-end turn still sends the normal ready request without inventing hidden orders.
## Resource Ledger Deltas

`WorldBase.resourceLedgerByTurn` stores bounded persisted `ResourceFlow[]` history. World deltas use the compact `resourceLedgerByTurn` delta field for newly changed or pruned ledger turns. Bootstrap/resync may include the bounded snapshot, but normal turn deltas must not rebroadcast full history.

Clients should keep `resourcesByCountry` as the current balance and use ledger entries only for explanations: income, expenses, net, categories, and recent sources.

## Event Contract Notes

Current country event option payloads are key-based. `GameEventOption` uses `labelKey`, optional `descriptionKey`, optional `tooltipKey`, `buttonTone`, and `GameEffect[]`; authored raw option `label`, raw `description`, `buttonColor`, and `autoChancePct` are legacy fields and must not be accepted in scenario event files.

`CountryEventRecord.history` stores `titleKey` and `optionLabelKey` for new event resolutions. It also stores resolved `scopes`, bounded `appliedEffects` summaries, and `explanationIds` that point to structured records in `WorldBase.explanationRecordsByTurn`. Old persisted `label` and `optionLabel` fields may still be read at restore/UI boundaries only as migration compatibility; new event runtime writes localization keys.

`WorldBase.explanationRecordsByTurn` stores bounded structured explanation records keyed by turn. Deltas use `WORLD_DELTA_MASK.explanationRecordsByTurn` and compact field `xr`; values are keyed by turn id and may be `null` when old explanation history is pruned. Manual country event choices currently produce records for resource-changing option effects with previous value, new value, source event, option cause, affected object, and resource value key.

`GameEventDefinition` now supports optional `scope` and `trigger` fields. The implemented scope slice supports `root` country scope and one region scope selected from `root.controlled_regions` or `root.owned_regions`. The implemented trigger DSL supports `all`, `any`, `not`, legacy country predicates, country resource predicates, country controlled-region count predicates, and scoped region predicates.

`PendingCountryEvent` may include `expiresTurnId`, `scopes`, and `triggerExplanation`. API event views pass these fields through to clients. Restore code must default old pending events to `expiresTurnId: null`, empty scopes, and empty trigger explanations.

`GameEventDefinition` supports `timeoutTurns`, `defaultOptionId`, and `chain`. Timeout resolution is explicit: events without `timeoutTurns` are not auto-resolved by age. Chain followups are persisted in `WorldBase.countryScheduledEventsByCountryId`, diffed through `WORLD_DELTA_MASK.countryScheduledEventsByCountryId`, encoded as compact field `s`, and applied by the client store. Event flags are reserved in `WorldBase.countryEventFlagsByCountryId`, diffed through `WORLD_DELTA_MASK.countryEventFlagsByCountryId`, and encoded as compact field `xg`.

`GameEffect` now includes event-control effects in addition to resource effects: `trigger_event`, `schedule_event`, `cancel_event`, `set_event_flag`, and `clear_event_flag`. Manual option resolution and timeout auto-resolution both apply these effects after resource effects. `trigger_event` creates a pending event immediately; `schedule_event` creates a scheduled event; `cancel_event` removes same-country pending and scheduled events by event id.

## Journal Contract Notes

`WorldBase.journalEntriesByCountryId` stores per-country active journal entries, completed/failed ids, cooldowns, and bounded history. Deltas use `WORLD_DELTA_MASK.journalEntriesByCountryId` and compact field `jo`; values are keyed by country id and may be `null` when a country journal state is removed.

The server produces journal deltas during turn resolution and country deletion cleanup. The client store applies `jo` into `worldBase.journalEntriesByCountryId` without requiring a full world reload.

`JournalEntryDefinition` reuses event `scope`, event `trigger`, trigger explanations, and `GameEffect`. The first runtime lifecycle slice starts entries from `startTrigger`, resolves active entries from `completeTrigger`, `failTrigger`, `cancelTrigger`, or `timeoutTurns`, and applies lifecycle resource/event effects through existing server pipelines.

`GameEffect` includes journal-control effects: `start_journal_entry`, `advance_journal_entry`, `complete_journal_entry`, `fail_journal_entry`, `cancel_journal_entry`, `set_journal_variable`, and `clear_journal_variable`. Manual country event choices include `journalEntriesByCountryId` in their delta snapshot so journal-control effects are visible to clients immediately.

`DecisionDefinition.effects` now accepts legacy `resource_delta` entries and shared `GameEffect` entries. Taking a decision snapshots resources, decision records, pending events, scheduled events, event flags, and journal entries so resource, event-control, and journal-control effects are delivered in the same world delta.

`CountryDecisionRecord.history` stores the legacy `label` plus resolved `scopes`, bounded `appliedEffects` summaries, and `explanationIds`. Taking a decision creates structured explanation records for resource costs and resource-changing effects when values are available. Old persisted history rows normalize missing scopes/effects/explanation ids to empty values. Client decision history should prefer these structured fields over reconstructing outcomes from current decision definitions.

`DecisionDefinition` also accepts `scope`, `potential`, `allow`, and `visibleWhenUnavailable`. `GET /decisions/:countryId` decision views include resolved `scopes`, trigger explanations, and structured `reasons[]` entries with localization keys; `POST /decisions/:countryId/:decisionId/take` includes the same reasons when returning `DECISION_UNAVAILABLE`. The legacy `reason` string remains a compatibility fallback only.

Event timeout auto-resolution now supports `GameEventOption.aiWeight`. When any option has authored AI utility rules, the server scores options with the trigger DSL and chooses the highest score. Events without `aiWeight` keep the compatibility fallback of `defaultOptionId`, `playerDefault`, then first option.
