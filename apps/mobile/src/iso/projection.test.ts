import { describe, expect, it } from 'vitest';
import {
  gridToWorld,
  tileAt,
  tileCenter,
  tileCorners,
  TILE_HEIGHT,
  TILE_WIDTH,
  worldToGrid,
} from './projection';

describe('isometric projection', () => {
  it('maps the grid axes to 2:1 diagonals', () => {
    expect(gridToWorld(0, 0)).toEqual({ x: 0, y: 0 });
    expect(gridToWorld(1, 0)).toEqual({
      x: TILE_WIDTH / 2,
      y: TILE_HEIGHT / 2,
    });
    expect(gridToWorld(0, 1)).toEqual({
      x: -TILE_WIDTH / 2,
      y: TILE_HEIGHT / 2,
    });
  });

  it('round-trips between grid and world', () => {
    for (const [i, j] of [
      [0, 0],
      [3, 7],
      [2.25, 5.5],
      [-1, 4],
    ] as const) {
      const g = worldToGrid(gridToWorld(i, j));
      expect(g.i).toBeCloseTo(i, 10);
      expect(g.j).toBeCloseTo(j, 10);
    }
  });

  it('finds the tile under a point', () => {
    expect(tileAt(tileCenter({ i: 4, j: 6 }))).toEqual({ i: 4, j: 6 });
    const [top, right, bottom, left] = tileCorners({ i: 4, j: 6 });
    // Just inside each corner of the diamond.
    expect(tileAt({ x: top.x, y: top.y + 2 })).toEqual({ i: 4, j: 6 });
    expect(tileAt({ x: right.x - 4, y: right.y })).toEqual({ i: 4, j: 6 });
    expect(tileAt({ x: bottom.x, y: bottom.y - 2 })).toEqual({ i: 4, j: 6 });
    expect(tileAt({ x: left.x + 4, y: left.y })).toEqual({ i: 4, j: 6 });
  });
});
