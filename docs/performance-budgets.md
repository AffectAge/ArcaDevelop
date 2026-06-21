# Performance Budgets

Performance-sensitive systems need explicit budgets before large changes.

## Required Budget Areas

- Turn resolve duration.
- AI tick duration.
- WS delta size and broadcast fanout.
- Snapshot size.
- Scenario validation time.
- Content loading time.
- Upload cleanup time.
- Map frame time.

## Map UI Frame Budget

- Target smooth pan/zoom on supported desktop.
- Avoid long main-thread work during map interactions.
- Use memoization, viewport filtering, tiling, or worker-friendly processing for large overlays.
- Test new map layers with large province counts when relevant.

## Reporting

If performance was not verified for a touched hot path, say so in the final report.
## Resource Ledger Budget

Resource ledger history is bounded by scenario defines. Keep `resourceLedger.retentionTurns` and `resourceLedger.maxEntriesPerTurn` conservative for large multiplayer worlds, and avoid per-client full-history broadcasts. Normal deltas should include only changed/pruned ledger turns.

Hot-path mechanics should aggregate where possible before appending flows, but must preserve enough source/category information for player-facing explanations.
