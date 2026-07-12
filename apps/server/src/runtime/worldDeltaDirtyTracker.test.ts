import { WORLD_DELTA_MASK } from "@arcanorum/shared";
import { describe, expect, it } from "vitest";
import { createWorldDeltaDirtyTracker, getDirtySnapshotDecision, getDirtySnapshotMask } from "./worldDeltaDirtyTracker";

describe("worldDeltaDirtyTracker", () => {
  it("builds snapshot masks from requested and dirty sections only", () => {
    const requestedMask = WORLD_DELTA_MASK.resourcesByCountry |
      WORLD_DELTA_MASK.regionPopulationByRegion |
      WORLD_DELTA_MASK.unitState;
    const dirtyMask = WORLD_DELTA_MASK.resourcesByCountry |
      WORLD_DELTA_MASK.diplomacyProposals;

    expect(getDirtySnapshotMask({ requestedMask, dirtyMask })).toBe(WORLD_DELTA_MASK.resourcesByCountry);
    expect(getDirtySnapshotDecision({ requestedMask, dirtyMask })).toEqual({
      requestedMask,
      dirtyMask,
      snapshotMask: WORLD_DELTA_MASK.resourcesByCountry,
      skippedMask: WORLD_DELTA_MASK.regionPopulationByRegion | WORLD_DELTA_MASK.unitState,
    });
  });

  it("tracks dirty sections and consumes only requested bits", () => {
    const tracker = createWorldDeltaDirtyTracker();
    tracker.markDirty(WORLD_DELTA_MASK.resourcesByCountry | WORLD_DELTA_MASK.regionBuildingsByRegion);
    tracker.markDirty(WORLD_DELTA_MASK.unitState);

    expect(tracker.hasDirty(WORLD_DELTA_MASK.resourcesByCountry)).toBe(true);
    const requestedSnapshotMask = WORLD_DELTA_MASK.resourcesByCountry | WORLD_DELTA_MASK.regionPopulationByRegion;
    expect(tracker.getSnapshotMask(requestedSnapshotMask)).toBe(WORLD_DELTA_MASK.resourcesByCountry);
    expect(tracker.getSnapshotDecision(requestedSnapshotMask)).toMatchObject({
      snapshotMask: WORLD_DELTA_MASK.resourcesByCountry,
      skippedMask: WORLD_DELTA_MASK.regionPopulationByRegion,
    });
    expect(tracker.consumeSnapshotDecision(requestedSnapshotMask)).toMatchObject({
      snapshotMask: WORLD_DELTA_MASK.resourcesByCountry,
      skippedMask: WORLD_DELTA_MASK.regionPopulationByRegion,
    });
    expect(tracker.hasDirty(WORLD_DELTA_MASK.resourcesByCountry)).toBe(false);
    expect(tracker.hasDirty(WORLD_DELTA_MASK.regionBuildingsByRegion)).toBe(true);
    expect(tracker.hasDirty(WORLD_DELTA_MASK.unitState)).toBe(true);

    tracker.markClean(WORLD_DELTA_MASK.regionBuildingsByRegion);
    expect(tracker.getDirtyMask()).toBe(WORLD_DELTA_MASK.unitState);
    tracker.clear();
    expect(tracker.getDirtyMask()).toBe(0);
  });
});
