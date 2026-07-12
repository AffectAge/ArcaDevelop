export type WorldDeltaDirtySnapshotDecision = {
  requestedMask: number;
  dirtyMask: number;
  snapshotMask: number;
  skippedMask: number;
};

export type WorldDeltaDirtyTracker = {
  markDirty: (mask: number) => void;
  markClean: (mask: number) => void;
  clear: () => void;
  getDirtyMask: () => number;
  hasDirty: (mask: number) => boolean;
  getSnapshotDecision: (requestedMask: number) => WorldDeltaDirtySnapshotDecision;
  getSnapshotMask: (requestedMask: number) => number;
  consumeSnapshotDecision: (requestedMask: number) => WorldDeltaDirtySnapshotDecision;
  consumeSnapshotMask: (requestedMask: number) => number;
};

export function createWorldDeltaDirtyTracker(initialDirtyMask = 0): WorldDeltaDirtyTracker {
  let dirtyMask = normalizeDeltaMask(initialDirtyMask);

  return {
    markDirty(mask: number): void {
      dirtyMask |= normalizeDeltaMask(mask);
    },
    markClean(mask: number): void {
      dirtyMask &= ~normalizeDeltaMask(mask);
    },
    clear(): void {
      dirtyMask = 0;
    },
    getDirtyMask(): number {
      return dirtyMask;
    },
    hasDirty(mask: number): boolean {
      return (dirtyMask & normalizeDeltaMask(mask)) !== 0;
    },
    getSnapshotDecision(requestedMask: number): WorldDeltaDirtySnapshotDecision {
      return getDirtySnapshotDecision({ requestedMask, dirtyMask });
    },
    getSnapshotMask(requestedMask: number): number {
      return getDirtySnapshotDecision({ requestedMask, dirtyMask }).snapshotMask;
    },
    consumeSnapshotDecision(requestedMask: number): WorldDeltaDirtySnapshotDecision {
      const decision = getDirtySnapshotDecision({ requestedMask, dirtyMask });
      dirtyMask &= ~decision.snapshotMask;
      return decision;
    },
    consumeSnapshotMask(requestedMask: number): number {
      const decision = getDirtySnapshotDecision({ requestedMask, dirtyMask });
      dirtyMask &= ~decision.snapshotMask;
      return decision.snapshotMask;
    },
  };
}

export function getDirtySnapshotDecision(params: { requestedMask: number; dirtyMask: number }): WorldDeltaDirtySnapshotDecision {
  const requestedMask = normalizeDeltaMask(params.requestedMask);
  const dirtyMask = normalizeDeltaMask(params.dirtyMask);
  const snapshotMask = requestedMask & dirtyMask;
  return {
    requestedMask,
    dirtyMask,
    snapshotMask,
    skippedMask: requestedMask & ~snapshotMask,
  };
}

export function getDirtySnapshotMask(params: { requestedMask: number; dirtyMask: number }): number {
  return getDirtySnapshotDecision(params).snapshotMask;
}

function normalizeDeltaMask(mask: number): number {
  return Math.max(0, Math.trunc(mask));
}
