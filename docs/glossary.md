# Glossary

- **Province:** Lightweight map and movement unit. Stores adjacency, terrain, climate, passability, movement cost, and map metadata.
- **State Region / Region:** Main heavy-mechanics unit. Owns population, buildings, construction, resources, economy, colonization, and territorial diplomacy.
- **Owner:** Legal country owner of a region.
- **Controller:** Country currently controlling/occupying a region and receiving its economy.
- **Core:** Historical/legal country claim treated as fundamental to that country.
- **Claim:** Detailed political claim with claimant, type, strength, source, and optional expiry.
- **Scenario:** Complete game setup: map, regions, countries, content, defines, AI, localization, Arcawiki, theme, and assets.
- **Hex Map Client Artifact:** Immutable, version-addressed generated map payload used only for client rendering and navigation. It consists of a manifest, compact row-major navigation data, and independently cacheable visual chunks.
- **Hex Map Chunk:** Bounded rectangular group of pointy-top offset hexes streamed and rendered as one lifecycle unit. Chunking does not change canonical `q/r` coordinates, map bounds, ownership, or movement rules.
- **Visual Halo:** The one-hex ring of neighboring tile data stored with a visual chunk so coast, river, feature, and border edges can be built without loading the full map. Halo tiles are context and are not duplicated gameplay ownership.
- **Map LOD:** A zoom bucket with hysteresis that selects which visual layers are visible. Far, Mid, and Near affect presentation only; they never change simulation or hit-testing geometry.
- **Map Asset Provenance Manifest:** Project-owned record linking reproducible map-art sources, license/origin statements, generated runtime outputs, and their content hashes.
- **Defines:** Scenario-owned balance and pacing configuration, similar to Victoria-style defines.
- **Arcawiki:** Player-facing guide/wiki for mechanics, UI concepts, strategy, and scenario lore.
- **AI Profile:** Scenario-authored AI personality/strategy configuration.
- **Order:** Player or AI request validated by the authoritative server.
- **World Delta:** Compact server-to-client state update with versioning and ACK/replay.
- **Fallback:** Alternate behavior used when normal data/path is missing. Gameplay fallback requires approval; technical safety fallback must be documented.
- **Event Option:** Scenario-authored choice on a country event. New authored options use localization keys and theme-driven `buttonTone`, not raw labels or colors.
- **Event Scope:** Resolved object context for an event, such as the root country and selected region. Pending events persist scopes so UI and debugging can explain what the event was about.
- **Event Chain:** Scenario-authored sequence of country events. Followups are scheduled as future events, then promoted to pending events when their scheduled turn arrives.
- **Event Timeout:** Explicit pending-event expiration turn calculated from `timeoutTurns`. Timeout resolution uses `defaultOptionId` when present.
- **Event Flag:** Country-scoped scripting value written by event effects. Event flags live in `WorldBase.countryEventFlagsByCountryId` and are cleaned up with country deletion.
- **Event-Control Effect:** `GameEffect` variant that triggers, schedules, cancels, sets, or clears event state instead of changing resources.
- **Event Trigger Explanation:** Structured explanation row captured when an event trigger is evaluated. It records the predicate, result, value, threshold, and affected object where applicable.
- **Explanation Record:** Bounded world-state record in `WorldBase.explanationRecordsByTurn` that explains an applied visible state change with turn, source system, source id, affected object, previous value, new value, causes, and related modifiers.
- **Game Effect:** Shared scripting effect payload used by events and future scripting systems. The current implemented event slice supports resource effects.
- **Journal Entry:** Scenario-authored country objective or situation tracked in `WorldBase.journalEntriesByCountryId`. Journal entries use localized text, event-style scopes/triggers, lifecycle outcomes, history, cooldowns, and shared effects.
- **Journal Lifecycle:** Runtime state transition for a journal entry: started, completed, failed, or cancelled. Lifecycle changes may apply resource effects, trigger events, and create history rows.
## Resource Ledger

The bounded country resource journal. Mechanics emit `ResourceFlow` income or expense entries; resource ledger runtime applies the net result to `resourcesByCountry` and stores recent history in `resourceLedgerByTurn` for UI explanations.

## Resource Deposit

A physical `good:*` deposit on one map hex. It is stored under a region for ownership, economy, and world deltas, but extraction buildings must target the specific deposit hex.

## Resource Flow

A single ledger entry for one country resource income or expense, including source type, source id, category id, amount, direction, and localization label key.
