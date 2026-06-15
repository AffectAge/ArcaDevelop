import { describe, expect, it, vi } from "vitest";
import { TtlAsyncCache } from "./ttlAsyncCache";

describe("TtlAsyncCache", () => {
  it("returns cached values before expiry", async () => {
    let now = 100;
    const cache = new TtlAsyncCache({ defaultTtlMs: 50, nowMs: () => now });
    const loader = vi.fn<() => Promise<string>>().mockResolvedValue("loaded");

    await expect(cache.get({ key: "country:list", loader })).resolves.toBe("loaded");
    now = 120;
    await expect(cache.get({ key: "country:list", loader })).resolves.toBe("loaded");

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("reloads expired entries", async () => {
    let now = 100;
    const cache = new TtlAsyncCache({ defaultTtlMs: 50, nowMs: () => now });
    const loader = vi.fn<() => Promise<string>>().mockResolvedValueOnce("one").mockResolvedValueOnce("two");

    await expect(cache.get({ key: "country:list", loader })).resolves.toBe("one");
    now = 151;
    await expect(cache.get({ key: "country:list", loader })).resolves.toBe("two");

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("clears entries explicitly", async () => {
    const cache = new TtlAsyncCache({ defaultTtlMs: 1_000, nowMs: () => 1 });
    const loader = vi.fn<() => Promise<string>>().mockResolvedValueOnce("one").mockResolvedValueOnce("two");

    await expect(cache.get({ key: "country:list", loader })).resolves.toBe("one");
    cache.clear();
    await expect(cache.get({ key: "country:list", loader })).resolves.toBe("two");

    expect(loader).toHaveBeenCalledTimes(2);
  });
});
