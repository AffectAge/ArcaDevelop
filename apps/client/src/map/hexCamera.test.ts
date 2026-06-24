import { describe, expect, it } from "vitest";
import {
  calculateEdgeScrollVelocity,
  centerCameraOnWorldPoint,
  normalizeHexCamera,
  screenToWorld,
  zoomCameraToScreenPoint,
  type HexCamera,
  type HexCameraBounds,
} from "./hexCamera";

const bounds: HexCameraBounds = {
  wrapWidth: 1_000,
  minX: -120,
  maxX: 1_120,
  minY: -100,
  maxY: 800,
  minScale: 0.1,
  maxScale: 3,
};

describe("hex camera helpers", () => {
  it("keeps the cursor world coordinate stable while zooming", () => {
    const camera: HexCamera = { x: 400, y: 300, scale: 1 };
    const viewport = { width: 800, height: 600 };
    const cursor = { x: 620, y: 430 };
    const before = screenToWorld(cursor, viewport, camera);
    const zoomed = zoomCameraToScreenPoint(camera, viewport, cursor, 1.7, bounds);
    const after = screenToWorld(cursor, viewport, zoomed);

    expect(after.x).toBeCloseTo(before.x, 5);
    expect(after.y).toBeCloseTo(before.y, 5);
  });

  it("clamps X camera movement with limited edge overscroll", () => {
    expect(normalizeHexCamera({ x: -250, y: 0, scale: 1 }, bounds).x).toBe(-120);
    expect(normalizeHexCamera({ x: 1_250, y: 0, scale: 1 }, bounds).x).toBe(1_120);
  });

  it("does not edge-scroll when blocked by UI", () => {
    const velocity = calculateEdgeScrollVelocity({ x: 2, y: 2 }, { width: 1000, height: 700 }, { enabled: true, blocked: true });

    expect(velocity).toEqual({ x: 0, y: 0 });
  });

  it("centers the camera target on selected world point", () => {
    const centered = centerCameraOnWorldPoint({ x: 10, y: 20, scale: 1.2 }, { x: 1400, y: 220 }, bounds);

    expect(centered.x).toBe(1_120);
    expect(centered.y).toBe(220);
    expect(centered.scale).toBe(1.2);
  });
});
