# ADR-0005: Universal Resource Ledger

## Status

Accepted.

## Context

Country resources were historically mutated directly by individual mechanics, routes, and runtime helpers. That made resource totals compatible with existing validation and AI, but it hid why a value changed and encouraged mechanic-specific accounting paths.

Arcanorum needs player-visible explanations for resource flows and a single mutation path that can scale across buildings, laws, technologies, events, trade, armies, diplomacy, colonization, construction, customization, and modifiers.

## Decision

Country-level resource changes are emitted as `ResourceFlow` ledger entries. Mechanics and routes do not directly mutate `worldBase.resourcesByCountry` for gameplay spends/income. They append income or expense entries with:

- country id, turn id, resource id, direction, and amount;
- source type and source id;
- category id;
- localization label key and optional params;
- optional bounded metadata.

`resourcesByCountry` remains the authoritative current balance for compatibility with order validation, AI, existing deltas, and top-level UI. `ResourceLedgerRuntime` buffers flows for the current turn, persists bounded history in `worldBase.resourceLedgerByTurn`, applies net totals once to `resourcesByCountry`, and prunes old turns according to scenario defines.

World deltas include compact `resourceLedgerByTurn` changes. They must not rebroadcast full ledger history every turn.

## Consequences

- New country resource mechanics must emit ledger flows instead of writing resource totals.
- Player-facing resource UI can show current value, income, expenses, net, grouped categories, and recent entries.
- Scenario defines own `resourceLedger.retentionTurns` and `resourceLedger.maxEntriesPerTurn`; invalid values fail validation.
- Local building and population wallets remain local economies unless they transfer to or from country resources.
- A code guard should flag new direct country resource writes outside ledger runtime and world normalizers.
