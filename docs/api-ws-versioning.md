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

Current compact world-delta fields include `j` for full-list `diplomacyProposals` replacement. Any new compact field must be documented here with its shared mask, server producer, and client consumer.

## Error Codes

Do not rely on raw human-readable server messages. Use machine-readable `code` values and localize UI messages on the client.
## Resource Ledger Deltas

`WorldBase.resourceLedgerByTurn` stores bounded persisted `ResourceFlow[]` history. World deltas use the compact `resourceLedgerByTurn` delta field for newly changed or pruned ledger turns. Bootstrap/resync may include the bounded snapshot, but normal turn deltas must not rebroadcast full history.

Clients should keep `resourcesByCountry` as the current balance and use ledger entries only for explanations: income, expenses, net, categories, and recent sources.
