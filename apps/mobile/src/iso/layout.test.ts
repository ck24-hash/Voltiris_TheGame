import { describe, expect, it } from 'vitest';
import {
  boxOutline,
  clampToLot,
  createLayout,
  greenhouseBounds,
  insidePolygon,
  lotBounds,
  PLANT_HIT_HALF_WIDTH,
  plotIndexAt,
  targetAt,
  type Footprint,
} from './layout';
import {
  gridToWorld,
  tileAt,
  tileCenter,
  worldToGrid,
  type GridPoint,
  type Point,
} from './projection';

function overlaps(a: Footprint, b: Footprint): boolean {
  return (
    a.i < b.i + b.width &&
    b.i < a.i + a.width &&
    a.j < b.j + b.length &&
    b.j < a.j + a.length
  );
}

function contains(outer: Footprint, inner: Footprint): boolean {
  return (
    inner.i >= outer.i &&
    inner.j >= outer.j &&
    inner.i + inner.width <= outer.i + outer.width &&
    inner.j + inner.length <= outer.j + outer.length
  );
}

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

  it.each([4, 20])(
    'fits the greenhouse, buildings and path on the lot without overlaps (%i plots)',
    (plots) => {
      const { lot, greenhouse, buildings, path } = createLayout(plots);
      const things = [greenhouse, ...buildings.map((b) => b.footprint)];
      for (const [k, a] of things.entries()) {
        expect(contains(lot, a)).toBe(true);
        expect(overlaps(a, path), `path crosses ${k}`).toBe(false);
        for (const b of things.slice(k + 1)) expect(overlaps(a, b)).toBe(false);
      }
    },
  );

  it('runs the road along the front of the lot, and the path from the door to it', () => {
    const { lot, road, path, greenhouse } = layout;
    expect(road.j0).toBeGreaterThan(lot.j + lot.length);
    expect(road.j1).toBeGreaterThan(road.j0);
    expect(path.j).toBe(greenhouse.j + greenhouse.length);
    expect(path.j + path.length).toBe(road.j0);
    expect(path.i + path.width / 2).toBe(greenhouse.i + greenhouse.width / 2);
  });

  it('puts the For sale signs on the neighbouring land', () => {
    for (const sign of layout.forSale) {
      expect(contains(layout.lot, { ...sign, width: 1, length: 1 })).toBe(
        false,
      );
    }
  });

  it('grows the greenhouse and the lot for more plots', () => {
    const big = createLayout(20);
    expect(big.plots).toHaveLength(20);
    expect(big.greenhouse.length).toBe(12);
    expect(big.lot.length).toBeGreaterThan(layout.lot.length);
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

describe('targetAt', () => {
  const layout = createLayout(4);
  const none = [0, 0, 0, 0];

  it('finds a building from its walls and roof', () => {
    for (const building of layout.buildings) {
      const { i, j, width, length } = building.footprint;
      const base = gridToWorld(i + width / 2, j + length / 2);
      expect(targetAt(layout, base, none)).toEqual({
        kind: 'building',
        id: building.id,
      });
      const roof = { x: base.x, y: base.y - building.height + 10 };
      expect(targetAt(layout, roof, none)).toMatchObject({ id: building.id });
    }
  });

  it('finds plots first, then signs, and nothing on empty lawn', () => {
    const plot = layout.plots[2] ?? { i: 0, j: 0 };
    expect(targetAt(layout, tileCenter(plot), none)).toEqual({
      kind: 'plot',
      index: 2,
    });
    const sign = tileCenter(layout.forSale[0] ?? { i: 0, j: 0 });
    expect(targetAt(layout, { x: sign.x, y: sign.y - 40 }, none)).toEqual({
      kind: 'forSale',
    });
    expect(targetAt(layout, tileCenter({ i: 9, j: 8 }), none)).toBeNull();
  });
});

describe('camera area', () => {
  const layout = createLayout(4);
  const clamp = clampToLot(layout);

  it('leaves a point over the lot alone', () => {
    const p = gridToWorld(6.5, 3.25);
    const clamped = clamp(p);
    expect(clamped.x).toBeCloseTo(p.x, 10);
    expect(clamped.y).toBeCloseTo(p.y, 10);
  });

  it('pulls a point beyond the lot back to just inside the fence', () => {
    const { lot } = layout;
    const g = worldToGrid(clamp(gridToWorld(-5, lot.length + 7)));
    expect(g.i).toBeCloseTo(lot.i + 2, 10);
    expect(g.j).toBeCloseTo(lot.j + lot.length - 2, 10);
  });

  it('has the greenhouse inside the lot bounds', () => {
    const lot = lotBounds(layout);
    const house = greenhouseBounds(layout);
    expect(house.minX).toBeGreaterThan(lot.minX);
    expect(house.maxX).toBeLessThan(lot.maxX);
    expect(house.maxY).toBeLessThan(lot.maxY);
  });
});

describe('insidePolygon', () => {
  const box = boxOutline({ i: 0, j: 0, width: 1, length: 1 }, 50);

  it('tells inside from outside', () => {
    expect(insidePolygon(tileCenter({ i: 0, j: 0 }), box)).toBe(true);
    expect(insidePolygon({ x: 0, y: -40 }, box)).toBe(true);
    expect(insidePolygon({ x: 0, y: 80 }, box)).toBe(false);
    expect(insidePolygon({ x: 100, y: 0 }, box)).toBe(false);
  });
});
