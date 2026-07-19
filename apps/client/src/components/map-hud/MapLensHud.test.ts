import { describe, expect, it } from "vitest";
import {
  buildMapLayerActiveState,
  reconcileMapLayerActiveState,
  toggleMapLayerActiveState,
} from "./MapLensHud";

const layers = [
  { id: "countryFill", label: "Country fill", active: true },
  { id: "hexGrid", label: "Hex grid", active: true },
] as const;

describe("MapLensHud layer state", () => {
  it("toggles locally and preserves that state across an unrelated parent render", () => {
    const initial = buildMapLayerActiveState(layers);
    const toggled = toggleMapLayerActiveState(initial, "countryFill", true);

    expect(toggled.countryFill).toBe(false);
    expect(reconcileMapLayerActiveState(toggled, layers, layers)).toBe(toggled);
  });

  it("synchronizes from parent state when the layers identity changes", () => {
    const initial = buildMapLayerActiveState(layers);
    const toggled = toggleMapLayerActiveState(initial, "countryFill", true);
    const nextLayers = layers.map((layer) => ({
      ...layer,
      active: layer.id === "countryFill" ? false : layer.active,
    }));

    const synchronized = reconcileMapLayerActiveState(
      toggled,
      layers,
      nextLayers,
    );
    expect(synchronized).not.toBe(toggled);
    expect(synchronized.countryFill).toBe(false);
    expect(synchronized.hexGrid).toBe(true);
  });
});
