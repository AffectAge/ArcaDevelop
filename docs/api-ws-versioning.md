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

## Error Codes

Do not rely on raw human-readable server messages. Use machine-readable `code` values and localize UI messages on the client.
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
