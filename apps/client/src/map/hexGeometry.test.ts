import { describe, expect, it } from "vitest";
import { HEX_DIRECTIONS, axialToPixel, getNeighborAxial, hexEdgeMidpoint, pixelToAxial } from "./hexGeometry";
import type { HexDirection } from "@arcanorum/shared";

describe("hex geometry helpers", () => {
  it("places edge midpoints toward matching rectangular offset neighbor directions", () => {
    const settings = { width: 12, height: 12, wrapX: false };
    const origin = { q: 4, r: 5 };
    const center = axialToPixel(origin, 20);
    for (let direction = 0; direction < HEX_DIRECTIONS.length; direction += 1) {
      const neighborAxial = getNeighborAxial(origin, direction as HexDirection, settings);
      expect(neighborAxial).toBeTruthy();
      const neighbor = axialToPixel(neighborAxial!, 20);
      const midpoint = hexEdgeMidpoint(center, 20, direction as HexDirection);
      const edgeVector = { x: midpoint.x - center.x, y: midpoint.y - center.y };
      const neighborVector = { x: neighbor.x - center.x, y: neighbor.y - center.y };
      const dot = edgeVector.x * neighborVector.x + edgeVector.y * neighborVector.y;

      expect(dot).toBeGreaterThan(0);
    }
  });

  it("round-trips rectangular offset centers through hit testing", () => {
    const settings = { width: 12, height: 12, wrapX: false };
    for (const hex of [{ q: 0, r: 0 }, { q: 4, r: 5 }, { q: 9, r: 8 }]) {
      const center = axialToPixel(hex, 20);
      expect(pixelToAxial(center.x, center.y, 20, settings)).toEqual(hex);
    }
  });
});
