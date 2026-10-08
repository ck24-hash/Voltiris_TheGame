import type { Point } from './projection';

/** World point shown at the centre of the screen, and the zoom level. */
export interface Camera {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface Rect {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface CameraLimits {
  readonly minZoom: number;
  readonly maxZoom: number;
  /** The camera centre stays inside these world bounds. */
  readonly bounds: Rect;
}

export function screenToWorld(s: Point, cam: Camera, vp: Viewport): Point {
  return {
    x: (s.x - vp.width / 2) / cam.zoom + cam.x,
    y: (s.y - vp.height / 2) / cam.zoom + cam.y,
  };
}

export function worldToScreen(w: Point, cam: Camera, vp: Viewport): Point {
  return {
    x: (w.x - cam.x) * cam.zoom + vp.width / 2,
    y: (w.y - cam.y) * cam.zoom + vp.height / 2,
  };
}

/** Position and scale to give the world container. */
export function containerTransform(
  cam: Camera,
  vp: Viewport,
): { x: number; y: number; scale: number } {
  return {
    x: vp.width / 2 - cam.x * cam.zoom,
    y: vp.height / 2 - cam.y * cam.zoom,
    scale: cam.zoom,
  };
}

export function clampCamera(cam: Camera, limits: CameraLimits): Camera {
  const { bounds } = limits;
  return {
    x: clamp(cam.x, bounds.minX, bounds.maxX),
    y: clamp(cam.y, bounds.minY, bounds.maxY),
    zoom: clamp(cam.zoom, limits.minZoom, limits.maxZoom),
  };
}

/** Moves the view by a drag of (dx, dy) screen pixels. */
export function panCamera(
  cam: Camera,
  dx: number,
  dy: number,
  limits: CameraLimits,
): Camera {
  return clampCamera(
    { ...cam, x: cam.x - dx / cam.zoom, y: cam.y - dy / cam.zoom },
    limits,
  );
}

/** Zooms by `factor`, keeping the world point under `screenPoint` in place. */
export function zoomCameraAt(
  cam: Camera,
  vp: Viewport,
  screenPoint: Point,
  factor: number,
  limits: CameraLimits,
): Camera {
  const zoom = clamp(cam.zoom * factor, limits.minZoom, limits.maxZoom);
  const anchor = screenToWorld(screenPoint, cam, vp);
  return clampCamera(
    {
      zoom,
      x: anchor.x - (screenPoint.x - vp.width / 2) / zoom,
      y: anchor.y - (screenPoint.y - vp.height / 2) / zoom,
    },
    limits,
  );
}

/** Centres on `rect` with the largest zoom that fits it, minus padding. */
export function fitCamera(
  rect: Rect,
  vp: Viewport,
  limits: CameraLimits,
  paddingPx = 24,
): Camera {
  const width = Math.max(1, rect.maxX - rect.minX);
  const height = Math.max(1, rect.maxY - rect.minY);
  const zoom = Math.min(
    (vp.width - 2 * paddingPx) / width,
    (vp.height - 2 * paddingPx) / height,
  );
  return clampCamera(
    {
      x: (rect.minX + rect.maxX) / 2,
      y: (rect.minY + rect.maxY) / 2,
      zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : 1,
    },
    limits,
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
