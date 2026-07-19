import { describe, expect, it, vi } from "vitest";
import { beginEntryGameTransition } from "./entryGameTransition";

describe("beginEntryGameTransition", () => {
  it("dismisses the gate immediately and activates the HUD only after a paint boundary", () => {
    const frames = createScheduledCallbacks<FrameRequestCallback>();
    const afterFrames = createScheduledCallbacks<() => void>();
    const dismissGate = vi.fn();
    const activateGameHud = vi.fn();

    beginEntryGameTransition({
      dismissGate,
      activateGameHud,
      requestFrame: frames.schedule,
      cancelFrame: frames.cancel,
      scheduleAfterFrame: afterFrames.schedule,
      cancelAfterFrame: afterFrames.cancel,
    });

    expect(dismissGate).toHaveBeenCalledOnce();
    expect(activateGameHud).not.toHaveBeenCalled();

    frames.runNext(16);
    expect(activateGameHud).not.toHaveBeenCalled();

    afterFrames.runNext();
    expect(activateGameHud).toHaveBeenCalledOnce();
  });

  it("cancels activation both before and after the frame callback", () => {
    const beforeFrame = createScheduledCallbacks<FrameRequestCallback>();
    const beforeFrameDelay = createScheduledCallbacks<() => void>();
    const firstActivation = vi.fn();
    const cancelBeforeFrame = beginEntryGameTransition({
      dismissGate: vi.fn(),
      activateGameHud: firstActivation,
      requestFrame: beforeFrame.schedule,
      cancelFrame: beforeFrame.cancel,
      scheduleAfterFrame: beforeFrameDelay.schedule,
      cancelAfterFrame: beforeFrameDelay.cancel,
    });

    cancelBeforeFrame();
    beforeFrame.runAll(16);
    beforeFrameDelay.runAll();
    expect(firstActivation).not.toHaveBeenCalled();

    const afterFrame = createScheduledCallbacks<FrameRequestCallback>();
    const afterFrameDelay = createScheduledCallbacks<() => void>();
    const secondActivation = vi.fn();
    const cancelAfterFrame = beginEntryGameTransition({
      dismissGate: vi.fn(),
      activateGameHud: secondActivation,
      requestFrame: afterFrame.schedule,
      cancelFrame: afterFrame.cancel,
      scheduleAfterFrame: afterFrameDelay.schedule,
      cancelAfterFrame: afterFrameDelay.cancel,
    });

    afterFrame.runNext(16);
    cancelAfterFrame();
    afterFrameDelay.runAll();
    expect(secondActivation).not.toHaveBeenCalled();
  });
});

function createScheduledCallbacks<T extends (...args: never[]) => void>() {
  let nextHandle = 1;
  const callbacks = new Map<number, T>();
  return {
    schedule: (callback: T): number => {
      const handle = nextHandle;
      nextHandle += 1;
      callbacks.set(handle, callback);
      return handle;
    },
    cancel: (handle: number): void => {
      callbacks.delete(handle);
    },
    runNext: (...args: Parameters<T>): void => {
      const entry = callbacks.entries().next().value as [number, T] | undefined;
      if (!entry) return;
      callbacks.delete(entry[0]);
      entry[1](...args);
    },
    runAll: (...args: Parameters<T>): void => {
      while (callbacks.size > 0) {
        const entry = callbacks.entries().next().value as [number, T];
        callbacks.delete(entry[0]);
        entry[1](...args);
      }
    },
  };
}
