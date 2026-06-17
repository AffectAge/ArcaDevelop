import { describe, expect, it } from "vitest";
import { countResolveReadyCountries } from "./websocketRuntime";

describe("websocketRuntime", () => {
  it("counts active AI countries as ready for turn resolve gating", () => {
    expect(
      countResolveReadyCountries({
        activeCountryIds: new Set(["country:player", "country:ai"]),
        readySet: new Set(["country:player"]),
        aiControlledCountryIds: new Set(["country:ai"]),
      }),
    ).toBe(2);
  });
});
