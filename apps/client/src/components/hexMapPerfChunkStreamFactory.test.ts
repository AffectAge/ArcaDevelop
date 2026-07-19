import { describe, expect, it, vi } from "vitest";
import { PrewarmedChunkStreamFactory } from "./hexMapPerfChunkStreamFactory";

describe("PrewarmedChunkStreamFactory", () => {
  it("terminates an unclaimed worker-backed stream when the perf surface unmounts", () => {
    const stream = { destroy: vi.fn() };
    const createStream = vi.fn(() => stream);
    const factory = new PrewarmedChunkStreamFactory(createStream);
    const prepare = vi.fn();

    expect(factory.prewarm()).toBe(stream);
    expect(factory.prewarm()).toBe(stream);
    expect(factory.withUnclaimed(stream, prepare)).toBe(true);
    factory.destroyUnused();

    expect(createStream).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledWith(stream);
    expect(stream.destroy).toHaveBeenCalledTimes(1);
  });

  it("hands ownership to MapView and creates a fresh stream after scenario-version cleanup", () => {
    const streams = [
      { destroy: vi.fn(), id: "prewarmed" },
      { destroy: vi.fn(), id: "replacement" },
    ];
    const factory = new PrewarmedChunkStreamFactory(() => {
      const stream = streams.shift();
      if (!stream) throw new Error("unexpected stream request");
      return stream;
    });

    factory.prewarm();
    const initial = factory.take();
    expect(factory.withUnclaimed(initial, vi.fn())).toBe(false);
    factory.destroyUnused();
    expect(initial.id).toBe("prewarmed");
    expect(initial.destroy).not.toHaveBeenCalled();

    // MapView owns the claimed stream and destroys it when scenario/version
    // dependencies change before acquiring the replacement generation.
    initial.destroy();
    const replacement = factory.take();
    expect(initial.destroy).toHaveBeenCalledTimes(1);
    expect(replacement.id).toBe("replacement");
  });
});
