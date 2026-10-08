import { describe, expect, it } from 'vitest';
import {
  createLayout,
  greenhouseBounds,
  groundBounds,
  PLANT_HIT_HALF_WIDTH,
  plotIndexAt,
} from './layout';
import {
  gridToWorld,
  tileAt,
  tileCenter,
  type GridPoint,
  type Point,
} from './projection';

describe('createLayout', () => {
  const layout = createLayout(4);

  it('places the plots in two columns inside the greenhouse walls', () => {
    const { i, j, width, length } = layout.greenhouse;
    expect(layout.plots).toHaveLength(4);
    for (const plot of layout.plots) {
      expect(plot.i).toBeGreaterThan(i);
      expect(plot.i).toBeLessThan(i + width - 1);
      expect(plot.j).toBeGreaterThan(j);
      expect(plot.j).toBeLessThan(j + length - 1);
    }
    const keys = layout.plots.map((p) => `${p.i},${p.j}`);
    expect(new Set(keys).size).toBe(4);
  });

  it('keeps the greenhouse on the ground with room around it', () => {
    const { i, j, width, length } = layout.greenhouse;
    expect(i).toBeGreaterThanOrEqual(2);
    expect(j).toBeGreaterThanOrEqual(2);
    expect(i + width).toBeLessThanOrEqual(layout.groundSize - 2);
    expect(j + length).toBeLessThanOrEqual(layout.groundSize - 2);
  });

  it('grows the greenhouse and ground for more plots', () => {
    const big = createLayout(20);
    expect(big.plots).toHaveLength(20);
    expect(big.greenhouse.length).toBe(12);
    expect(big.groundSize).toBeGreaterThan(layout.groundSize);
  });
});

/** Points spread over a tile's diamond, just inside its edges. */
function pointsOnTile(tile: GridPoint): Point[] {
  const points: Point[] = [];
  for (let a = 0.03; a < 1; a += 0.0625) {
    for (let b = 0.03; b < 1; b += 0.0625) {
      points.push(gridToWorld(tile.i + a, tile.j + b));
    }
  }
  return points;
}

describe('plotIndexAt', () => {
  // Plots: 0 back, 1 right, 2 left, 3 front (directly below 0 on screen).
  const layout = createLayout(4);
  const [back, right, , front] = layout.plots as [
    GridPoint,
    GridPoint,
    GridPoint,
    GridPoint,
  ];
  const tall = 200;

  it('selects a plot from anywhere on its tile, however tall its neighbours grow', () => {
    // Plot 0 is empty and boxed in by tall plants on every front side.
    const heights = [0, tall, tall, tall];
    for (const p of pointsOnTile(back)) {
      expect(plotIndexAt(layout, p, heights)).toBe(0);
    }
    layout.plots.forEach((tile, index) => {
      expect(
        plotIndexAt(layout, tileCenter(tile), [tall, tall, tall, tall]),
      ).toBe(index);
    });
  });

  it('selects a plant from its leaves above the tiles', () => {
    const c = tileCenter(back);
    const aboveBackTile = { x: c.x, y: c.y - 60 };
    expect(tileAt(aboveBackTile)).not.toEqual(back);
    expect(plotIndexAt(layout, aboveBackTile, [100, 0, 0, 0])).toBe(0);

    const r = tileCenter(right);
    expect(plotIndexAt(layout, { x: r.x, y: r.y - 50 }, [0, 100, 0, 0])).toBe(
      1,
    );
  });

  it('only reaches as high and wide as the drawn plant', () => {
    const c = tileCenter(back);
    const above = { x: c.x, y: c.y - 60 };
    expect(plotIndexAt(layout, above, [20, 0, 0, 0])).toBeNull();
    const beside = { x: c.x + PLANT_HIT_HALF_WIDTH + 1, y: c.y - 60 };
    expect(plotIndexAt(layout, beside, [100, 0, 0, 0])).toBeNull();
  });

  it('prefers the plant in front where plants overlap above the tiles', () => {
    const c = tileCenter(back);
    expect(tileCenter(front).x).toBe(c.x);
    // Above every tile, inside both the back and the front plant.
    const p = { x: c.x, y: c.y - 100 };
    expect(plotIndexAt(layout, p, [tall, 0, 0, tall])).toBe(3);
    expect(plotIndexAt(layout, p, [tall, 0, 0, 0])).toBe(0);
  });

  it('returns null away from the plots', () => {
    expect(
      plotIndexAt(layout, tileCenter({ i: 0, j: 0 }), [tall, tall, tall, tall]),
    ).toBeNull();
  });
});

describe('bounds', () => {
  it('puts the greenhouse inside the ground', () => {
    const layout = createLayout(4);
    const ground = groundBounds(layout);
    const house = greenhouseBounds(layout);
    expect(house.minX).toBeGreaterThan(ground.minX);
    expect(house.maxX).toBeLessThan(ground.maxX);
    expect(house.maxY).toBeLessThan(ground.maxY);
  });
});
