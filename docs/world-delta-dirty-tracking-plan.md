# World Delta Dirty Tracking Plan

## Goal

Reduce server turn cost by replacing broad `structuredClone` snapshotting and full-section delta scans with explicit dirty-section tracking. The intended player-facing effect is smoother turns and lower websocket delay during busy multiplayer sessions, without changing gameplay rules or the `WORLD_DELTA` client contract.

## Current Baseline

- Runtime code clones selected `WorldBase` sections before mutations and later compares the clone with the next world state.
- This is safe, but expensive for large worlds because unchanged sections still pay clone and comparison costs when their mask is selected.
- Payload metrics historically built both compact and verbose baseline payloads even when only compact websocket deltas were broadcast.

## Proposed Implementation Phases

1. **Keep compact deltas authoritative.** Continue broadcasting the existing compact `WORLD_DELTA` payload while making verbose baseline payload construction debug-only/lazy.
2. **Add dirty section markers.** Introduce a small runtime-owned dirty tracker keyed by existing `WORLD_DELTA_MASK` bits. Mutators mark sections dirty after validated changes.
3. **Capture snapshots only for dirty sections.** When a turn starts, clone only sections whose mask bits are expected to be mutated. Avoid `structuredClone` for untouched sections.
4. **Use section-level version counters.** For high-churn maps such as resources, populations, units, buildings, and explanations, increment a section version and skip deep diffing if the version did not change.
5. **Add guard tests.** Verify that every mutating runtime path marks the correct section, and that omitted dirty marks fail tests by producing stale deltas.
6. **Add bounded metrics.** Track counts and bytes for cloned sections, skipped sections, compact payload bytes, and optional debug baseline bytes without storing unbounded samples.

## Safety Constraints

- Do not change gameplay outcomes, order validation, or delta schema in the same step as dirty tracking.
- Do not rely on client-side trust; the server remains authoritative.
- Keep a debug fallback that can rebuild a baseline payload on demand for tests and diagnostics.
- Dirty tracking must be local to the turn/runtime pipeline and must not create hidden persistent state.

## Rollout Checks

- Unit tests for each dirty marker and each skipped section.
- Replay tests for compact deltas generated from dirty-only snapshots.
- A temporary debug assertion mode that compares dirty-only output with full-snapshot output in tests.
- Size/timing metrics before and after rollout to confirm lower clone/diff overhead.
