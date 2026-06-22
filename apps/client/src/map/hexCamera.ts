import type { HexMapSettings } from "@arcanorum/shared";

export type HexCamera = {
  x: number;
  y: number;
  scale: number;
};

export type HexCameraBounds = {
  wrapWidth: number;
  minY: number;
  maxY: number;
  minScale: number;
  maxScale: number;
};

export type ScreenPoint = {
  x: number;
  y: number;
};

export type ViewportRect = {
  width: number;
  height: number;
};

export type EdgeScrollVelocity = {
  x: number;
  y: number;
};

export const HEX_CAMERA_MIN_SCALE = 0.14;
export const HEX_CAMERA_MAX_SCALE = 2.2;
export const HEX_CAMERA_EDGE_MARGIN_PX = 44;
export const HEX_CAMERA_EDGE_MAX_SPEED_PX_PER_SECOND = 720;

export function buildHexCameraBounds(settings: Pick<HexMapSettings, "height" | "hexSize">, wrapWidth: number): HexCameraBounds {
  return {
    wrapWidth,
    minY: -600,
    maxY: settings.height * settings.hexSize * 1.9,
    minScale: HEX_CAMERA_MIN_SCALE,
    maxScale: HEX_CAMERA_MAX_SCALE,
  };
}

export function clampScale(scale: number, bounds: Pick<HexCameraBounds, "minScale" | "maxScale">): number {
  return Math.max(bounds.minScale, Math.min(bounds.maxScale, scale));
}

export function normalizeHexCamera(camera: HexCamera, bounds: HexCameraBounds): HexCamera {
  return {
    ...camera,
    x: ((camera.x % bounds.wrapWidth) + bounds.wrapWidth) % bounds.wrapWidth,
    y: Math.max(bounds.minY, Math.min(camera.y, bounds.maxY)),
    scale: clampScale(camera.scale, bounds),
  };
}

export function screenToWorld(point: ScreenPoint, viewport: ViewportRect, camera: HexCamera): ScreenPoint {
  return {
    x: (point.x - viewport.width / 2) / camera.scale + camera.x,
    y: (point.y - viewport.height / 2) / camera.scale + camera.y,
  };
}

export function zoomCameraToScreenPoint(
  camera: HexCamera,
  viewport: ViewportRect,
  point: ScreenPoint,
  nextScale: number,
  bounds: HexCameraBounds,
): HexCamera {
  const scale = clampScale(nextScale, bounds);
  const world = screenToWorld(point, viewport, camera);
  return normalizeHexCamera(
    {
      x: world.x - (point.x - viewport.width / 2) / scale,
      y: world.y - (point.y - viewport.height / 2) / scale,
      scale,
    },
    bounds,
  );
}

export function centerCameraOnWorldPoint(camera: HexCamera, point: ScreenPoint, bounds: HexCameraBounds): HexCamera {
  return normalizeHexCamera({ ...camera, x: point.x, y: point.y }, bounds);
}

export function calculateEdgeScrollVelocity(
  pointer: ScreenPoint | null,
  viewport: ViewportRect,
  options: { enabled: boolean; blocked: boolean; margin?: number; maxSpeed?: number },
): EdgeScrollVelocity {
  if (!pointer || !options.enabled || options.blocked) {
    return { x: 0, y: 0 };
  }
  const margin = options.margin ?? HEX_CAMERA_EDGE_MARGIN_PX;
  const maxSpeed = options.maxSpeed ?? HEX_CAMERA_EDGE_MAX_SPEED_PX_PER_SECOND;
  return {
    x: calculateEdgeAxis(pointer.x, viewport.width, margin, maxSpeed),
    y: calculateEdgeAxis(pointer.y, viewport.height, margin, maxSpeed),
  };
}

export function smoothCameraToward(current: HexCamera, target: HexCamera, bounds: HexCameraBounds, deltaSeconds: number, stiffness = 12): HexCamera {
  const alpha = 1 - Math.exp(-stiffness * Math.max(0, deltaSeconds));
  let dx = target.x - current.x;
  if (Math.abs(dx) > bounds.wrapWidth / 2) {
    dx = dx > 0 ? dx - bounds.wrapWidth : dx + bounds.wrapWidth;
  }
  return normalizeHexCamera(
    {
      x: current.x + dx * alpha,
      y: current.y + (target.y - current.y) * alpha,
      scale: current.scale + (target.scale - current.scale) * alpha,
    },
    bounds,
  );
}

function calculateEdgeAxis(value: number, size: number, margin: number, maxSpeed: number): number {
  if (value < margin) {
    const strength = (margin - Math.max(0, value)) / margin;
    return -maxSpeed * strength * strength;
  }
  if (value > size - margin) {
    const strength = (Math.min(size, value) - (size - margin)) / margin;
    return maxSpeed * strength * strength;
  }
  return 0;
}
