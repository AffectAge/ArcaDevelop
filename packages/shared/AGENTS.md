# Shared Contract Agents

Always start from root `AGENTS.md` and `docs/README.md` before using this folder guide.

Use this guide for `packages/shared`.

Also read:

- `docs/api-ws-versioning.md`
- `docs/engineering-standards.md`
- `docs/concurrency.md`

## Contract Steward Agent

Shared types are the contract between client and server. Any world-model change must be updated across:

- shared contracts,
- server producers/validators,
- client consumers/store/UI,
- tests and docs.

Do not add province-level heavy mechanic fields without explicit approval.

New public contracts require stable names, typed payloads, stable error codes where relevant, compatibility/removal notes, and tests.

## Region Contract Agent

The shared world model must move toward region-first heavy mechanics:

- region ownership/control,
- region population,
- region buildings,
- region construction,
- region resources,
- region colonization,
- region diplomacy transfer.

Province contracts should remain focused on movement/map data and lightweight metadata.

## Delta Protocol Agent

World deltas must stay compact and versioned. When adding region state:

- add explicit region delta sections,
- keep province and region masks separate,
- preserve ACK/replay behavior,
- avoid full snapshots except bootstrap/resync,
- add tests for apply/replay/idempotency.

Rejected orders must use stable machine-readable error codes for localization.

Do not encode player-facing text in shared protocol payloads when an error code/localization key is appropriate.

## Resource Ledger Contract Agent

Country resource mutations are represented by shared `ResourceFlow` records and bounded `resourceLedgerByTurn` history. `resourcesByCountry` remains the authoritative current balance for compatibility, validation, AI, and existing UI, but contracts must preserve ledger deltas so clients can explain income, expenses, net totals, categories, and recent entries without receiving full history every turn.

`ResourceFlow.labelKey` is the player-facing label contract. Do not put raw player-facing text in ledger entries; use localization keys and optional params.
