import { describe, expect, it } from "vitest";
import {
  RESOURCE_DEPOSIT_ATLAS_COLUMNS,
  RESOURCE_DEPOSIT_ATLAS_TIERS,
  RESOURCE_DEPOSIT_ATLAS_VARIANTS,
  getResourceDepositAtlasRow,
  resolveResourceDepositAtlasFrame,
  resolveResourceDepositTier,
  resolveResourceDepositVariant,
} from "./resourceDepositAtlas";

describe("resourceDepositAtlas", () => {
  it("resolves rows and stable frames for shared resource deposit atlas", () => {
    expect(getResourceDepositAtlasRow("good:wood")).not.toBe(getResourceDepositAtlasRow("good:coal"));
    expect(RESOURCE_DEPOSIT_ATLAS_COLUMNS).toBe(RESOURCE_DEPOSIT_ATLAS_TIERS * RESOURCE_DEPOSIT_ATLAS_VARIANTS);

    const variant = resolveResourceDepositVariant("good:coal:hex:1:2");
    expect(variant).toBeGreaterThanOrEqual(0);
    expect(variant).toBeLessThan(RESOURCE_DEPOSIT_ATLAS_VARIANTS);
    expect(resolveResourceDepositVariant("good:coal:hex:1:2")).toBe(variant);

    expect(resolveResourceDepositTier({ amount: 10, maxAmount: 100 })).toBe(0);
    expect(resolveResourceDepositTier({ amount: 85, maxAmount: 100 })).toBe(3);
    const frame = resolveResourceDepositAtlasFrame({ goodId: "good:coal", hexId: "hex:1:2", amount: 85, maxAmount: 100 });
    expect(frame).toBeGreaterThanOrEqual(RESOURCE_DEPOSIT_ATLAS_VARIANTS * 3);
    expect(frame).toBeLessThan(RESOURCE_DEPOSIT_ATLAS_COLUMNS);
  });
});
