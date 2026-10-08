import { describe, expect, it } from 'vitest';
import { clampCamera, worldToScreen } from './camera';
import { createLayout, lotBounds, yardBounds } from './layout';
import { cameraLimits, firstView } from './view';

const layout = createLayout(4);

describe.each([
  ['a landscape phone', { width: 914, height: 411 }],
  ['an iPhone in landscape', { width: 852, height: 393 }],
  ['a tablet', { width: 1366, height: 1024 }],
])('on %s', (_name, viewport) => {
  it('opens on the whole yard, clear of the HUD on the left and top', () => {
    const camera = firstView(layout, viewport);
    const yard = yardBounds(layout);
    const topLeft = worldToScreen(
      { x: yard.minX, y: yard.minY },
      camera,
      viewport,
    );
    const bottomRight = worldToScreen(
      { x: yard.maxX, y: yard.maxY },
      camera,
      viewport,
    );
    expect(topLeft.x).toBeGreaterThanOrEqual(124);
    expect(topLeft.y).toBeGreaterThanOrEqual(52);
    expect(bottomRight.x).toBeLessThanOrEqual(viewport.width);
    expect(bottomRight.y).toBeLessThanOrEqual(viewport.height);
  });

  it('zooms out only until the whole lot fits', () => {
    const limits = cameraLimits(layout, viewport);
    const lot = lotBounds(layout);
    const fits =
      (lot.maxX - lot.minX) * limits.minZoom <= viewport.width + 1e-9 &&
      (lot.maxY - lot.minY) * limits.minZoom <= viewport.height + 1e-9;
    expect(fits).toBe(true);
    expect(limits.minZoom).toBeLessThanOrEqual(1);
    const zoomedOut = clampCamera({ x: 0, y: 0, zoom: 0.01 }, limits);
    expect(zoomedOut.zoom).toBe(limits.minZoom);
  });
});
