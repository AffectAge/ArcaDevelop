# AI Testing

AI work requires automated tests because AI decisions affect economy, diplomacy, war, colonization, and player trust.

## Unit Tests

Test:

- rule filters,
- utility scoring,
- personality/archetype merging,
- budget limits,
- no-cheat constraints,
- zero-territory behavior.

## Fixture Scenario Tests

Use small deterministic scenarios for:

- economy choices,
- construction choices,
- diplomacy decisions,
- colonization race behavior,
- military/war decisions,
- budget behavior,
- player-to-AI takeover,
- AI-to-player handoff.

Exact snapshots are acceptable for small deterministic fixtures.

## Long Simulations

Use multi-turn simulations with metric ranges rather than brittle exact snapshots.

Track:

- runtime,
- memory,
- order count,
- rejected order count,
- bankruptcies,
- territorial expansion,
- wars/conflicts,
- colonization progress,
- economic growth/decline,
- AI idle turns.

Failures should explain whether the issue is logic, balance, data, performance, or nondeterminism.
