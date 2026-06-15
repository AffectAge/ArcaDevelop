type TurnSessionRuntimeParams = {
  resolveReadyByTurn: Map<number, Set<string>>;
  nowMs?: () => number;
};

export function createTurnSessionRuntime(params: TurnSessionRuntimeParams): {
  getReadySetForTurn: (turn: number) => Set<string>;
  getCurrentTurnStartedAtMs: () => number;
  resetTurnTimerAnchor: () => void;
} {
  const nowMs = params.nowMs ?? Date.now;
  let currentTurnStartedAtMs = nowMs();

  function getReadySetForTurn(turn: number): Set<string> {
    let readySet = params.resolveReadyByTurn.get(turn);
    if (!readySet) {
      readySet = new Set<string>();
      params.resolveReadyByTurn.set(turn, readySet);
    }
    return readySet;
  }

  function resetTurnTimerAnchor(): void {
    currentTurnStartedAtMs = nowMs();
  }

  return {
    getReadySetForTurn,
    getCurrentTurnStartedAtMs: () => currentTurnStartedAtMs,
    resetTurnTimerAnchor,
  };
}
