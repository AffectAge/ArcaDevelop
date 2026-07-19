export type EntryGameFrameScheduler = {
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (handle: number) => void;
  scheduleAfterFrame: (callback: () => void) => number;
  cancelAfterFrame: (handle: number) => void;
};

type BeginEntryGameTransitionParams = EntryGameFrameScheduler & {
  dismissGate: () => void;
  activateGameHud: () => void;
};

/**
 * Dismiss the blocking entry gate synchronously, then activate the expensive
 * gameplay HUD in a separate task after the browser has had a paint chance.
 */
export function beginEntryGameTransition(
  params: BeginEntryGameTransitionParams,
): () => void {
  let cancelled = false;
  let frameHandle: number | null = null;
  let afterFrameHandle: number | null = null;

  params.dismissGate();
  frameHandle = params.requestFrame(() => {
    frameHandle = null;
    if (cancelled) return;
    afterFrameHandle = params.scheduleAfterFrame(() => {
      afterFrameHandle = null;
      if (!cancelled) params.activateGameHud();
    });
  });

  return () => {
    if (cancelled) return;
    cancelled = true;
    if (frameHandle != null) params.cancelFrame(frameHandle);
    if (afterFrameHandle != null) params.cancelAfterFrame(afterFrameHandle);
    frameHandle = null;
    afterFrameHandle = null;
  };
}
