import { describe, expect, it } from "vitest";
import { HEX_DIRECTIONS, axialToPixel, hexEdgeMidpoint } from "./hexGeometry";
import type { HexDirection } from "@arcanorum/shared";

describe("hex geometry helpers", () => {
  it("places edge midpoints toward matching axial neighbor directions", () => {
    const center = axialToPixel({ q: 4, r: 4 }, 20);
    for (let direction = 0; direction < HEX_DIRECTIONS.length; direction += 1) {
      const offset = HEX_DIRECTIONS[direction];
      const neighbor = axialToPixel({ q: 4 + offset.q, r: 4 + offset.r }, 20);
      const midpoint = hexEdgeMidpoint(center, 20, direction as HexDirection);
      const edgeVector = { x: midpoint.x - center.x, y: midpoint.y - center.y };
      const neighborVector = { x: neighbor.x - center.x, y: neighbor.y - center.y };
      const dot = edgeVector.x * neighborVector.x + edgeVector.y * neighborVector.y;

      expect(dot).toBeGreaterThan(0);
    }
  });
});
