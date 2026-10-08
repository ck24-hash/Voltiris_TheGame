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
export const PLOT_COLUMNS = 2;
/** Height of the greenhouse walls in world pixels. */
export const WALL_HEIGHT = 110;
/** Tappable area above a plot's centre, where its plant is drawn. */
export const PLANT_HIT = { halfWidth: 34, height: 96 };

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
 * The plot under a world point: first the plants (front to back, since
 * plants overlap the tiles behind them), then the plot tiles themselves.
 * `planted[k]` says whether plot k has a plant to tap.
 */
export function plotIndexAt(
  layout: SceneLayout,
  p: Point,
  planted: readonly boolean[],
): number | null {
  const frontToBack = layout.plots
    .map((tile, index) => ({ tile, index }))
    .filter(({ index }) => planted[index])
    .sort((a, b) => depth(b.tile) - depth(a.tile));

  for (const { tile, index } of frontToBack) {
    const c = tileCenter(tile);
    const insideColumn =
      Math.abs(p.x - c.x) <= PLANT_HIT.halfWidth &&
      p.y <= c.y &&
      p.y >= c.y - PLANT_HIT.height;
    if (insideColumn) return index;
  }

  const tile = tileAt(p);
  const index = layout.plots.findIndex((t) => t.i === tile.i && t.j === tile.j);
  return index === -1 ? null : index;
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
