import { describe, expect, it } from 'vitest';
import {
  createLayout,
  greenhouseBounds,
  groundBounds,
  PLANT_HIT,
  plotIndexAt,
} from './layout';
import { depth, tileCenter, tileCorners } from './projection';

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

describe('plotIndexAt', () => {
  const layout = createLayout(4);
  const none = [false, false, false, false];
  const all = [true, true, true, true];

  it('finds each plot from its tile', () => {
    layout.plots.forEach((tile, index) => {
      expect(plotIndexAt(layout, tileCenter(tile), none)).toBe(index);
      const [top] = tileCorners(tile);
      expect(plotIndexAt(layout, { x: top.x, y: top.y + 3 }, none)).toBe(index);
    });
  });

  it('finds a plot from a tap on its plant', () => {
    layout.plots.forEach((tile, index) => {
      const c = tileCenter(tile);
      const tip = { x: c.x, y: c.y - PLANT_HIT.height + 4 };
      expect(plotIndexAt(layout, tip, all)).toBe(index);
      expect(plotIndexAt(layout, tip, none)).not.toBe(index);
    });
  });

  it('prefers the plant in front where plants overlap', () => {
    const front = layout.plots.reduce((a, b) => (depth(b) > depth(a) ? b : a));
    const behind = { i: front.i - 1, j: front.j - 1 };
    expect(layout.plots).toContainEqual(behind);
    const c = tileCenter(front);
    // Inside both plant columns: the front one rises over the one behind.
    const p = { x: c.x, y: c.y - 80 };
    expect(plotIndexAt(layout, p, all)).toBe(layout.plots.indexOf(front));
  });

  it('lets taps reach the tile behind an empty plot', () => {
    const [first] = layout.plots;
    if (!first) throw new Error('no plots');
    const [, right] = tileCorners(first);
    const nearRightCorner = { x: right.x - 6, y: right.y };
    const firstIndex = 0;
    expect(
      plotIndexAt(layout, nearRightCorner, [true, false, true, false]),
    ).toBe(firstIndex);
  });

  it('returns null away from the plots', () => {
    expect(plotIndexAt(layout, tileCenter({ i: 0, j: 0 }), all)).toBeNull();
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
