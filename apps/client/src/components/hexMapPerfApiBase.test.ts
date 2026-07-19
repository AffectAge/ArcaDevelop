import { describe, expect, it } from "vitest";
import { resolveHexMapPerfApiBase } from "./hexMapPerfApiBase";

describe("resolveHexMapPerfApiBase", () => {
  it("accepts an explicit loopback fixture endpoint on the auth-free performance route", () => {
    expect(
      resolveHexMapPerfApiBase(
        {
          pathname: "/hex-perf",
          search: "?perfApiBase=http%3A%2F%2F127.0.0.1%3A43123%2Ffixtures%2F200k",
        },
        "http://127.0.0.1:3001",
      ),
    ).toBe("http://127.0.0.1:43123/fixtures/200k");
  });

  it("ignores the debug query outside the dedicated performance route", () => {
    expect(
      resolveHexMapPerfApiBase(
        { pathname: "/", search: "?perfApiBase=http://127.0.0.1:43123/fixtures/default" },
        "http://127.0.0.1:3001",
      ),
    ).toBe("http://127.0.0.1:3001");
  });

  it.each([
    "https://127.0.0.1:43123/fixtures/default",
    "http://example.com:43123/fixtures/default",
    "http://127.0.0.1/fixtures/default",
    "http://user@127.0.0.1:43123/fixtures/default",
    "http://127.0.0.1:43123/anything/default",
    "http://127.0.0.1:43123/fixtures/unknown",
  ])("rejects a non-loopback or non-fixture endpoint: %s", (perfApiBase) => {
    expect(() =>
      resolveHexMapPerfApiBase(
        { pathname: "/hex-perf", search: `?perfApiBase=${encodeURIComponent(perfApiBase)}` },
        "http://127.0.0.1:3001",
      ),
    ).toThrow("HEX_MAP_PERF_API_BASE_REJECTED");
  });
});
