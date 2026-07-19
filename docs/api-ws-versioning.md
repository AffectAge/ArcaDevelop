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

The Civ-like unit contract uses grouped mask `WORLD_DELTA_MASK.unitState` because the current numeric bitmask is near its 32-bit limit. The grouped mask carries compact fields `mu` (`unitsById`), `uq` (`unitTrainingQueueByCountry`), `cu` (`civilianUnitsById` during the remaining colonizer transition), `cq` (`civilianUnitQueueByCountry`), `sp` (`settlementProjectsById`), and `ci` (`cityMarkersById`). Server producer: `apps/server/src/runtime/worldDeltaDiff.ts`. Client consumer: `apps/client/src/store/gameStore.ts`. Deleted old military/equipment compact fields are not reused in this task.

## Error Codes

Do not rely on raw human-readable server messages. Use machine-readable `code` values and localize UI messages on the client.

## Unit And Settlement Orders

The shared order union uses `MapUnit` as the only tactical unit model:

- `UNIT_MOVE`: moves an owned `MapUnit` toward a server-validated target hex. The order may include a contiguous route; the server validates passability and spends movement points over one or more turns.
- `UNIT_ATTACK`: requests a Civ-like melee or ranged attack from an owned `MapUnit` against a target hex/unit.
- `UNIT_PROMOTE`: applies a valid skill choice to an owned `MapUnit` and consumes the unit action for that turn.
- `UNIT_SKIP_TURN`: spends a `MapUnit` action for the current turn only, removing it from the turn action checklist until the next turn.
- `UNIT_SLEEP`: puts a `MapUnit` into `sleeping` status so it no longer blocks turn readiness until explicitly woken.
- `UNIT_FORTIFY`: puts a `MapUnit` into `fortified` status, consumes the current action, and keeps it inactive until woken.
- `UNIT_WAKE`: returns an owned sleeping or fortified `MapUnit` to `idle` through the normal validated order pipeline without granting extra movement.
- `FOUND_CITY`: consumes a `colonizer` civilian unit and starts a region-owned settlement project at the unit hex when the target region is neutral and eligible.

`COLONIZE` remains a legacy/internal compatibility order while the player UI transitions away from button colonization. New player-facing colonization should use `FOUND_CITY`.

`FOUND_CITY` is validated both on order submission and during turn resolution. The server requires a trimmed city `name` from 1 to 32 characters, the referenced colonizer to belong to the order country, stand on `targetHexId`, and target a hex inside `regionId`. The region must be neutral, colonization must not be disabled, and there must be no active/stalled settlement project for that region. On acceptance during turn resolution, the colonizer is removed immediately and a named `SettlementProject` is created. Settlement progress spends colonization points through the resource ledger with `resourceLedger.source.settlement.progress`; the region owner/controller changes only when the project completes, at which point the server creates a named `CityMarker`.

Player-facing colonization UI must use colonizer units, pending `FOUND_CITY` orders, and `SettlementProject` state. The legacy `COLONIZE` order may still be present in compatibility/admin paths, but the map client should not create pending colony overlays or resource-spend forecasts from player `COLONIZE` orders.

Stacking is Civ-like for this first slice: one combat `MapUnit` plus one civilian `MapUnit` may occupy a hex for the same country. Naval and future air units are represented by `MapUnit.domain` through `UnitTypeDefinition.domain`; there are no separate `Fleet` or `AirWing` containers.

The old military constructor protocol is intentionally removed without migration: `ARMY_MOVE`, `EQUIPMENT_VARIANT`, `EQUIPMENT_PRODUCTION_LINE`, `/army/*`, `/military/formations`, `/military/divisions/*`, `/military/air-wings/*`, and `/military/equipment/*` are not target player contracts.

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

Static client map delivery uses the content-addressed format from ADR-0011:

- `GET /hex-map/manifest` returns `HexMapClientManifest` directly. It is public, readonly, uses `Cache-Control: no-cache`, and supports ETag revalidation.
- `GET /hex-map/navigation?version=<hash>` returns `HexMapNavigationArtifact` directly. It contains row-major passability, water-kind, movement-cost, stop-on-enter, and region-index arrays plus compact river edge tuples.
- `GET /hex-map/chunks/:chunkId?version=<hash>` returns the requested `HexMapClientChunk` directly. A chunk includes primary tiles, a one-neighbor visual halo, touching river/coast records, and special feature instances owned by primary tiles.

Navigation and chunk responses use `Cache-Control: public, max-age=31536000, immutable`, `Vary: Accept-Encoding`, and prebuilt identity/gzip/Brotli variants. `version` must equal the active manifest's `artifactVersion`; chunk IDs are resolved only through the active manifest descriptor allowlist. The three endpoints are idempotent public GETs, so they require no auth, audit event, idempotency key, or additional route-specific rate limit.

`MAP_ARTIFACT_UNAVAILABLE` (`503`), `MAP_VERSION_MISMATCH` (`409`), and `MAP_CHUNK_NOT_FOUND` (`404`) use the normalized `{ code }` error shape. `/hex-map/artifact` and `/hex-map/features` are removed without compatibility fallback. Special map features now travel in their owning chunks. The internal `.generated/hex-map.json` remains the authoritative server/generator input for movement and corridor validation and is not a public transport contract.

`GET /hex-map/feature-visuals` returns `{ visuals: MapFeatureVisualRuleDefinition[] }` for scenario-authored conditional frame rules. If it returns an empty list, the client uses built-in defaults. Conditions are evaluated against current `HexTile` visual metadata such as `mapTags`, `waterKind`, `temperatureBand`, `moistureBand`, `distanceToWater`, `isCoastal`, and `riverMask`; removed raw `biome` fields are not a transport fallback.

`GET /hex-map/natural-feature-visuals` returns `NaturalFeatureVisualCatalog`: scenario-authored rules plus safe runtime URLs resolved from optional stable `asset:*` texture-set overrides. Rules use `ecoregion:*`, detailed `natural:*`, and `vegetation:*` queries to return placement recipes — allowed atlas frames `0..15`, count range, named composition layout, scale, rotation, layer, and simplified/detail LOD — rather than a pre-composed image. The client deterministically bakes matching objects into visible chunk RenderTextures; this readonly endpoint does not carry GPU state.

## Transport Corridor Contract

Transport corridor v2 routes are server-authoritative regional infrastructure. `POST /markets/:marketId/corridors/preview` accepts `waypoints` and `transportMode`, recalculates the route from map movement cost, validates city endpoints/build rights/transit constraints, and returns `computedHexIds`, `connectedRegionIds`, `connectedCityMarkerIds`, `routeCost`, and `costConstruction`.

`POST /markets/:marketId/corridors` uses the same payload and validation. Clients must not send or trust final `hexIds`; persisted corridors store `schemaVersion: 2`, authored `waypoints`, server `computedHexIds`, connected regions/city nodes, construction progress, capacity/load history, and optional `pendingLevel` for upgrades. Legacy v1 corridor records are removed during restore/runtime normalization because they cannot be safely mapped to region-level city-node access.

`PATCH /markets/:marketId/corridors/:corridorId` accepts `action: "open" | "close" | "upgrade" | "cancel" | "demolish"`. `cancel` deletes an owned corridor only while it is still `building`; `demolish` deletes an owned corridor only after it is no longer building. Both actions persist the market corridor state and return the updated corridor list. The current concurrency strategy is explicit rejection on stale/invalid status plus last-writer persistence in the in-memory game settings runtime.

`MarketOverviewResponse.logisticsSnapshot` includes `coverageByModeByRegion` and corridor service areas include `connectedRegionIds`/`connectedCityMarkerIds` so clients can explain regional access without scanning the world.

Scenario corridor visuals use `/scenario-assets/<scenarioId>/assets/corridors/corridor-atlas.png`, with a client-owned fallback at `/game-assets/corridors/fallback-corridor-atlas.png`. The atlas is `4096x1600`, sliced into `64x64` frames. Columns `0..63` are the six-direction hex connection bitmask for a corridor tile; rows are grouped by transport mode (`land`, `sea`, `air`, `pipeline`, `powerGrid`) and status (`planned`, `building`, `active`, `overloaded`, `closed`). This allows same-mode corridor branches, junctions, and crossings to resolve to one tile frame instead of overlapping line sprites.

## Unit Movement Orders

`UNIT_MOVE`, `UNIT_ATTACK`, `UNIT_PROMOTE`, `UNIT_SKIP_TURN`, `UNIT_SLEEP`, `UNIT_FORTIFY`, and `UNIT_WAKE` target individual `MapUnit` records from `unitsById`. The server validates ownership, current unit status, queued-order conflicts, route contiguity for movement, melee/ranged target legality for attacks, promotion choice legality, and resting-state legality for wake. The client uses `/turn/actions` to guide players toward blocking idle units, but readiness remains a UX layer: force-end turn still sends the normal ready request without inventing hidden orders.

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
