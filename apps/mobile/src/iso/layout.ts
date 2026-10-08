import type { Rect } from './camera';
import {
  depth,
  gridToWorld,
  tileAt,
  tileCenter,
  type GridPoint,
  type Point,
} from './projection';

/** Plots per row inside a greenhouse. */
const PLOT_COLUMNS = 2;
/** Height of the greenhouse walls in world pixels. */
export const WALL_HEIGHT = 110;
/** Half the width of a plant's tap area above its tile. */
export const PLANT_HIT_HALF_WIDTH = 30;

const MIN_GROUND_SIZE = 12;

export interface Footprint {
  readonly i: number;
  readonly j: number;
  /** Tiles along i. */
  readonly width: number;
  /** Tiles along j. */
  readonly length: number;
}

export interface SceneLayout {
  readonly groundSize: number;
  readonly greenhouse: Footprint;
  /** Tile of each plot, in the same order as Greenhouse.plots. */
  readonly plots: readonly GridPoint[];
}

/** A square of ground with the greenhouse centred on it. */
export function createLayout(plotCount: number): SceneLayout {
  const rows = Math.max(1, Math.ceil(plotCount / PLOT_COLUMNS));
  const width = PLOT_COLUMNS + 2;
  const length = rows + 2;
  const groundSize = Math.max(MIN_GROUND_SIZE, Math.max(width, length) + 6);
  const i = Math.floor((groundSize - width) / 2);
  const j = Math.floor((groundSize - length) / 2);

  return {
    groundSize,
    greenhouse: { i, j, width, length },
    plots: Array.from({ length: plotCount }, (_, k) => ({
      i: i + 1 + (k % PLOT_COLUMNS),
      j: j + 1 + Math.floor(k / PLOT_COLUMNS),
    })),
  };
}

/**
 * The plot under a world point. A plot's own tile always wins, so every plot
 * stays reachable however tall its neighbours grow. Above the tiles, the
 * plants themselves are tappable, front to back. `plantHeights[k]` is how far
 * plot k's plant reaches above its tile centre (0 for an empty plot).
 */
export function plotIndexAt(
  layout: SceneLayout,
  p: Point,
  plantHeights: readonly number[],
): number | null {
  const tile = tileAt(p);
  const onTile = layout.plots.findIndex(
    (t) => t.i === tile.i && t.j === tile.j,
  );
  if (onTile !== -1) return onTile;

  const frontToBack = layout.plots
    .map((tile, index) => ({ tile, index, height: plantHeights[index] ?? 0 }))
    .filter(({ height }) => height > 0)
    .sort((a, b) => depth(b.tile) - depth(a.tile));

  for (const { tile, index, height } of frontToBack) {
    const c = tileCenter(tile);
    const insidePlant =
      Math.abs(p.x - c.x) <= PLANT_HIT_HALF_WIDTH &&
      p.y <= c.y &&
      p.y >= c.y - height;
    if (insidePlant) return index;
  }
  return null;
}

/** World bounding box of the ground diamond. */
export function groundBounds(layout: SceneLayout): Rect {
  const n = layout.groundSize;
  return {
    minX: gridToWorld(0, n).x,
    maxX: gridToWorld(n, 0).x,
    minY: gridToWorld(0, 0).y,
    maxY: gridToWorld(n, n).y,
  };
}

/** World bounding box of the greenhouse, walls and roof included. */
export function greenhouseBounds(layout: SceneLayout): Rect {
  const { i, j, width, length } = layout.greenhouse;
  return {
    minX: gridToWorld(i, j + length).x,
    maxX: gridToWorld(i + width, j).x,
    minY: gridToWorld(i, j).y - WALL_HEIGHT * 1.8,
    maxY: gridToWorld(i + width, j + length).y,
  };
}
