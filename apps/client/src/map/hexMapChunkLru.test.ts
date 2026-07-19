import { describe, expect, it } from "vitest";
import { BoundedChunkLru } from "./hexMapChunkLru";

describe("BoundedChunkLru", () => {
  it("evicts the least-recently-used unpinned entry by count", () => {
    const cache = new BoundedChunkLru<string, number>({ maxEntries: 2, maxBytes: 100 });
    cache.set("a", 1, 10);
    cache.set("b", 2, 10);
    cache.get("a");

    expect(cache.set("c", 3, 10)).toEqual(["b"]);
    expect(cache.keys()).toEqual(["a", "c"]);
  });

  it("respects byte limits and never evicts pinned viewport entries", () => {
    const cache = new BoundedChunkLru<string, number>({ maxEntries: 4, maxBytes: 20 });
    cache.set("visible", 1, 15);
    cache.setPinned(new Set(["visible"]));

    expect(cache.set("overscan", 2, 15)).toEqual(["overscan"]);
    expect(cache.keys()).toEqual(["visible"]);
    expect(cache.bytes).toBe(15);
  });

  it("reports every resident key when cleared for a version change", () => {
    const cache = new BoundedChunkLru<string, number>({ maxEntries: 4, maxBytes: 100 });
    cache.set("a", 1, 10);
    cache.set("b", 2, 10);
    expect(cache.clear()).toEqual(["a", "b"]);
    expect(cache.size).toBe(0);
    expect(cache.bytes).toBe(0);
  });
});
