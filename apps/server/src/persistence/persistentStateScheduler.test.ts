import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersistentStateScheduler } from "./persistentStateScheduler";

describe("PersistentStateScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces repeated schedule calls into one persist", async () => {
    const persist = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const onError = vi.fn();
    const scheduler = new PersistentStateScheduler({ debounceMs: 50, persist, onError });

    scheduler.schedule();
    scheduler.schedule();
    scheduler.schedule();

    expect(persist).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(50);
    await scheduler.flushNow();

    expect(persist).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("flushes dirty state immediately", async () => {
    const persist = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const scheduler = new PersistentStateScheduler({ debounceMs: 1_000, persist, onError: vi.fn() });

    scheduler.schedule();
    await scheduler.flushNow();

    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("reports errors and allows later saves", async () => {
    const persist = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValueOnce(undefined);
    const onError = vi.fn();
    const scheduler = new PersistentStateScheduler({ debounceMs: 10, persist, onError });

    scheduler.schedule();
    await scheduler.flushNow();
    scheduler.schedule();
    await scheduler.flushNow();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(2);
  });
});
