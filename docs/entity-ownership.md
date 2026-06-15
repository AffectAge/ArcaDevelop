# Entity Ownership

Use this as the practical ownership map for cleanup and validation.

## Ownership Map

| Entity | Owner | Cleanup notes |
| --- | --- | --- |
| Scenario | Server/data admin | Owns per-entity history, common content, defines, AI, localization, Arcawiki, theme, assets, and generated indexes |
| Country | Scenario/runtime | Owns flag, crest, resources, orders, AI plans, armies, events, some market/diplomacy references |
| Region | Scenario/runtime | Owns province membership, pops, buildings, construction, region resources/extraction, claims, modifiers, economy, colonization, and territory-transfer state |
| Province | Scenario map/movement | Authored in `history/provinces/*.json`; stores terrain, climate, passability, movement cost, adjacency metadata, special sites, and local deposits only |
| Uploaded file | Scenario entity | Must have owner/reference and cleanup lifecycle |
| Content entry | Scenario content | Authored one file per entry under `common/*/*.json`; referenced by regions, countries, UI, Arcawiki, mechanics |
| AI profile | Scenario AI config | Referenced by countries |
| Arcawiki entry | Scenario Arcawiki | Authored in `arcawiki/entries/*.json`; player-facing; references content/regions/mechanics |
| Localization key | Scenario localization | Referenced by UI/content/Arcawiki/errors |
| Generated index | Scenario tooling | Built under `.generated/`; never the authored source of truth |

## Rule

Deleting an entity requires checking every owner/reference row that can point to it.

Scenario validation must reject orphaned per-entity files, broken stable-ID references, duplicate IDs, stale generated indexes, and province files that contain region-heavy state.
