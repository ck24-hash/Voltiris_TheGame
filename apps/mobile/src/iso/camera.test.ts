import { describe, expect, it } from 'vitest';
import {
  clampCamera,
  containerTransform,
  fitCamera,
  panCamera,
  screenToWorld,
  worldToScreen,
  zoomCameraAt,
  type Camera,
  type CameraLimits,
} from './camera';

const vp = { width: 800, height: 400 };
const limits: CameraLimits = {
  minZoom: 0.5,
  maxZoom: 2,
  bounds: { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 },
};
const cam: Camera = { x: 100, y: 50, zoom: 1.5 };

describe('camera', () => {
  it('converts between screen and world both ways', () => {
    const world = { x: 123, y: -45 };
    const back = screenToWorld(worldToScreen(world, cam, vp), cam, vp);
    expect(back.x).toBeCloseTo(world.x, 10);
    expect(back.y).toBeCloseTo(world.y, 10);
  });

  it('shows the camera point at the centre of the screen', () => {
    expect(worldToScreen({ x: cam.x, y: cam.y }, cam, vp)).toEqual({
      x: 400,
      y: 200,
    });
    const t = containerTransform(cam, vp);
    expect(t.x + cam.x * t.scale).toBe(400);
    expect(t.y + cam.y * t.scale).toBe(200);
  });

  it('pans opposite to the drag, scaled by zoom', () => {
    const moved = panCamera(cam, 30, -15, limits);
    expect(moved).toEqual({ x: 100 - 30 / 1.5, y: 50 + 15 / 1.5, zoom: 1.5 });
  });

  it('keeps the point under the fingers fixed while zooming', () => {
    const anchor = { x: 650, y: 120 };
    const before = screenToWorld(anchor, cam, vp);
    const zoomed = zoomCameraAt(cam, vp, anchor, 1.2, limits);
    const after = screenToWorld(anchor, zoomed, vp);
    expect(zoomed.zoom).toBeCloseTo(1.8, 10);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it('clamps zoom and position to the limits', () => {
    expect(zoomCameraAt(cam, vp, { x: 400, y: 200 }, 10, limits).zoom).toBe(2);
    expect(zoomCameraAt(cam, vp, { x: 400, y: 200 }, 0.01, limits).zoom).toBe(
      0.5,
    );
    expect(clampCamera({ x: 5000, y: -5000, zoom: 1 }, limits)).toEqual({
      x: 1000,
      y: -1000,
      zoom: 1,
    });
  });

  it('fits a rectangle inside the viewport with padding', () => {
    const rect = { minX: 0, minY: 0, maxX: 376, maxY: 88 };
    const fitted = fitCamera(rect, vp, limits, 12);
    expect(fitted).toEqual({ x: 188, y: 44, zoom: 2 });

    const wide = fitCamera(
      { minX: 0, minY: 0, maxX: 1552, maxY: 100 },
      vp,
      limits,
      24,
    );
    expect(wide.zoom).toBeCloseTo(0.5, 10);
  });
});
