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


## Phase Gates

Every AI implementation phase must report the exact verification commands that ran:

- typecheck: `npm run typecheck -ws`;
- relevant unit tests for changed AI, economy, market, diplomacy, military, scenario, or shared-contract code;
- AI fixture tests once the fixture harness exists, including `npm run test:unit -- apps/server/src/ai/aiContext.test.ts apps/server/src/ai/aiEconomyCandidates.test.ts apps/server/src/ai/aiMarketCandidates.test.ts apps/server/src/ai/aiStrategyScoring.test.ts apps/server/src/ai/aiCrisisMode.test.ts apps/server/src/ai/aiDiplomacyMilitaryCandidates.test.ts apps/server/src/ai/aiRuntimePlanner.test.ts apps/server/src/ai/aiOrderSubmissionAdapter.test.ts apps/server/src/runtime/aiRuntimeCoordinator.test.ts` for the Phase 2/3/4/5/6/7, runtime-planner, validated-draft adapter, and guarded runtime coordinator AI harnesses;
- colonization AI changes must include candidate tests for landless first-region choice, adjacent expansion, legality filters, resource gates, deterministic ordering, profile scoring, draft conversion, and runtime validation errors;
- colonization capture changes must test empty-region starter population, populated-region no-duplicate behavior, disabled or zero settlement defines, and `regionPopulationByRegion` world delta coverage;
- docs check: `npm run docs:check`.

If an expected AI fixture command does not exist yet, the phase report must say so explicitly and either add the command in that phase or explain why it is deferred. Do not mark a phase complete by silently skipping fixture coverage.
