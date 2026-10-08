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
  /** Moves a camera centre back inside the area it may look at. */
  readonly clampCenter: (center: Point) => Point;
}

/** Screen space covered by UI on each side, so the camera can work around it. */
export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** Keeps the camera centre inside a rectangle. */
export function clampToRect(rect: Rect): (center: Point) => Point {
  return (p) => ({
    x: clamp(p.x, rect.minX, rect.maxX),
    y: clamp(p.y, rect.minY, rect.maxY),
  });
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
  const { x, y } = limits.clampCenter(cam);
  return { x, y, zoom: clamp(cam.zoom, limits.minZoom, limits.maxZoom) };
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

/**
 * Two-finger gesture: zoom by `scale` around the old finger midpoint `from`,
 * then move with the fingers to `to`, so the world stays under the fingers.
 */
export function pinchCamera(
  cam: Camera,
  vp: Viewport,
  from: Point,
  to: Point,
  scale: number,
  limits: CameraLimits,
): Camera {
  const zoomed = zoomCameraAt(cam, vp, from, scale, limits);
  return panCamera(zoomed, to.x - from.x, to.y - from.y, limits);
}

/** The largest zoom at which `rect` fits in a `width` × `height` screen area. */
export function fitZoom(rect: Rect, width: number, height: number): number {
  const zoom = Math.min(
    width / Math.max(1, rect.maxX - rect.minX),
    height / Math.max(1, rect.maxY - rect.minY),
  );
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

/**
 * Shows `rect` as large as it fits, minus padding, centred in the part of the
 * screen not covered by UI (`insets`).
 */
export function fitCamera(
  rect: Rect,
  vp: Viewport,
  limits: CameraLimits,
  paddingPx = 24,
  insets: Insets = NO_INSETS,
): Camera {
  const zoom = clamp(
    fitZoom(
      rect,
      vp.width - insets.left - insets.right - 2 * paddingPx,
      vp.height - insets.top - insets.bottom - 2 * paddingPx,
    ),
    limits.minZoom,
    limits.maxZoom,
  );
  return clampCamera(
    {
      x: (rect.minX + rect.maxX) / 2 - (insets.left - insets.right) / 2 / zoom,
      y: (rect.minY + rect.maxY) / 2 - (insets.top - insets.bottom) / 2 / zoom,
      zoom,
    },
    limits,
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
