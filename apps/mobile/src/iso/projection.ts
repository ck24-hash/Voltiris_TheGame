// 2:1 isometric projection. Grid axis i runs down-right on screen, j runs
// down-left. Tile (i, j) covers grid [i, i + 1) × [j, j + 1).

export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 64;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface GridPoint {
  readonly i: number;
  readonly j: number;
}

export function gridToWorld(i: number, j: number): Point {
  return {
    x: ((i - j) * TILE_WIDTH) / 2,
    y: ((i + j) * TILE_HEIGHT) / 2,
  };
}

export function worldToGrid(p: Point): GridPoint {
  const a = p.x / (TILE_WIDTH / 2);
  const b = p.y / (TILE_HEIGHT / 2);
  return { i: (a + b) / 2, j: (b - a) / 2 };
}

export function tileAt(p: Point): GridPoint {
  const g = worldToGrid(p);
  return { i: Math.floor(g.i), j: Math.floor(g.j) };
}

export function tileCenter(tile: GridPoint): Point {
  return gridToWorld(tile.i + 0.5, tile.j + 0.5);
}

/** Diamond corners of a tile: top, right, bottom, left. */
export function tileCorners(tile: GridPoint): [Point, Point, Point, Point] {
  return [
    gridToWorld(tile.i, tile.j),
    gridToWorld(tile.i + 1, tile.j),
    gridToWorld(tile.i + 1, tile.j + 1),
    gridToWorld(tile.i, tile.j + 1),
  ];
}

/** Draw order: higher depth is closer to the viewer. */
export function depth(tile: GridPoint): number {
  return tile.i + tile.j;
}
