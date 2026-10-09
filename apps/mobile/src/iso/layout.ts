import type { Rect } from './camera';
import {
  depth,
  gridToWorld,
  tileAt,
  tileCenter,
  worldToGrid,
  type GridPoint,
  type Point,
} from './projection';

// The player's lot sits on endless land, with the road along its front
// (+j) edge. The greenhouse door faces the road; the other buildings stand
// on the lot until later phases let the player place them.

/** Plots per row inside a greenhouse. */
const PLOT_COLUMNS = 2;
/** Height of the greenhouse walls in world pixels. */
export const WALL_HEIGHT = 110;
/** How far the roof's ridge rises above the walls. */
export const ROOF_RISE = 64;
/** Half the width of a plant's tap area above its tile. */
export const PLANT_HIT_HALF_WIDTH = 30;

const LOT_WIDTH = 14;
/** Lot depth in front of the greenhouse, for the yard and the road-side buildings. */
const FRONT_YARD = 4;
const ROAD_WIDTH = 2;
/** Grass verge between the lot's fence and the road. */
const VERGE = 0.5;

export interface Footprint {
  readonly i: number;
  readonly j: number;
  /** Tiles along i. */
  readonly width: number;
  /** Tiles along j. */
  readonly length: number;
}

/** Buildings that open a game mode when tapped. */
export type BuildingId = 'market' | 'storage' | 'energy' | 'village';

export interface Building {
  readonly id: BuildingId;
  readonly footprint: Footprint;
  /** How far the drawing reaches above the ground, in world pixels. */
  readonly height: number;
}

/** Equipment that stands on the greenhouse floor. */
type FloorEquipment = 'heater' | 'fertigation' | 'co2' | 'fogger';

export interface SceneLayout {
  /** Land the player owns; the camera stays over it. */
  readonly lot: Footprint;
  readonly greenhouse: Footprint;
  /** Tile of each plot, in the same order as Greenhouse.plots. */
  readonly plots: readonly GridPoint[];
  /**
   * Where each floor-standing device goes: along the back walls, behind
   * every plot, so it never hides a plant.
   */
  readonly equipmentSpots: Readonly<Record<FloorEquipment, GridPoint>>;
  readonly buildings: readonly Building[];
  /** The road runs along i forever, between these j values. */
  readonly road: { readonly j0: number; readonly j1: number };
  /** Footpath from the greenhouse door to the road. */
  readonly path: Footprint;
  /** Where the "For sale" signs stand on the neighbouring land. */
  readonly forSale: readonly GridPoint[];
}

export function createLayout(plotCount: number): SceneLayout {
  const rows = Math.max(1, Math.ceil(plotCount / PLOT_COLUMNS));
  const greenhouse = { i: 5, j: 2, width: PLOT_COLUMNS + 2, length: rows + 2 };
  const front = greenhouse.j + greenhouse.length;
  const lot = { i: 0, j: 0, width: LOT_WIDTH, length: front + FRONT_YARD };
  const roadStart = lot.j + lot.length + VERGE;
  const door = greenhouse.i + greenhouse.width / 2;

  return {
    lot,
    greenhouse,
    plots: Array.from({ length: plotCount }, (_, k) => ({
      i: greenhouse.i + 1 + (k % PLOT_COLUMNS),
      j: greenhouse.j + 1 + Math.floor(k / PLOT_COLUMNS),
    })),
    equipmentSpots: {
      fertigation: { i: greenhouse.i, j: greenhouse.j },
      heater: { i: greenhouse.i, j: greenhouse.j + 1 },
      co2: { i: greenhouse.i + 1, j: greenhouse.j },
      fogger: { i: greenhouse.i + 2, j: greenhouse.j },
    },
    // Placed so no name tag hangs over another building: the market and the
    // storage barn by the road, the energy shed beside the greenhouse it
    // powers, the town hall at the back. The middle of the front yard stays
    // free for later.
    buildings: [
      {
        id: 'energy',
        footprint: { i: 11, j: greenhouse.j, width: 2, length: 2 },
        height: 100,
      },
      {
        id: 'storage',
        footprint: { i: 11, j: front, width: 2, length: 2 },
        height: 110,
      },
      {
        id: 'market',
        footprint: { i: 1, j: front, width: 2, length: 2 },
        height: 84,
      },
      {
        id: 'village',
        footprint: { i: 1, j: greenhouse.j, width: 2, length: 2 },
        height: 150,
      },
    ],
    road: { j0: roadStart, j1: roadStart + ROAD_WIDTH },
    path: {
      i: door - 0.5,
      j: front,
      width: 1,
      length: roadStart - front,
    },
    forSale: [
      { i: lot.i - 2, j: lot.j + 4 },
      { i: lot.i + 7, j: lot.j - 2 },
      { i: lot.i + lot.width + 1, j: lot.j + 6 },
    ],
  };
}

/** Ground corners of a footprint: back, right, front, left. */
function footprintCorners(f: Footprint): [Point, Point, Point, Point] {
  return [
    gridToWorld(f.i, f.j),
    gridToWorld(f.i + f.width, f.j),
    gridToWorld(f.i + f.width, f.j + f.length),
    gridToWorld(f.i, f.j + f.length),
  ];
}

/** Screen outline of a box standing on `f`, `height` pixels tall. */
export function boxOutline(f: Footprint, height: number): Point[] {
  const [back, right, front, left] = footprintCorners(f);
  const up = (p: Point) => ({ x: p.x, y: p.y - height });
  return [left, front, right, up(right), up(back), up(left)];
}

/** Ray casting: is `p` inside the polygon? */
export function insidePolygon(p: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let k = 0, prev = polygon.length - 1; k < polygon.length; prev = k++) {
    const a = polygon[k];
    const b = polygon[prev];
    if (!a || !b) continue;
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
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

export type WorldTarget =
  | { readonly kind: 'plot'; readonly index: number }
  | { readonly kind: 'building'; readonly id: BuildingId }
  | { readonly kind: 'greenhouse' }
  | { readonly kind: 'forSale' };

/** Half the size of a "For sale" sign's tap area, around its board. */
const SIGN_HIT = { halfWidth: 46, top: 72, bottom: 10 } as const;

/**
 * What a tap at a world point lands on: a plot, a building, the greenhouse
 * around the plots, or a sign.
 */
export function targetAt(
  layout: SceneLayout,
  p: Point,
  plantHeights: readonly number[],
): WorldTarget | null {
  const plot = plotIndexAt(layout, p, plantHeights);
  if (plot !== null) return { kind: 'plot', index: plot };

  const frontToBack = [...layout.buildings].sort(
    (a, b) => footprintDepth(b.footprint) - footprintDepth(a.footprint),
  );
  for (const building of frontToBack) {
    if (insidePolygon(p, boxOutline(building.footprint, building.height))) {
      return { kind: 'building', id: building.id };
    }
  }

  if (insidePolygon(p, greenhouseOutline(layout.greenhouse))) {
    return { kind: 'greenhouse' };
  }

  const onSign = layout.forSale.some((tile) => {
    const c = tileCenter(tile);
    return (
      Math.abs(p.x - c.x) <= SIGN_HIT.halfWidth &&
      p.y >= c.y - SIGN_HIT.top &&
      p.y <= c.y + SIGN_HIT.bottom
    );
  });
  return onSign ? { kind: 'forSale' } : null;
}

function footprintDepth(f: Footprint): number {
  return f.i + f.width / 2 + f.j + f.length / 2;
}

/**
 * Screen outline of the greenhouse: its walls, and the gable roof whose back
 * end peaks above the back-right wall.
 */
function greenhouseOutline(f: Footprint): Point[] {
  const [back, right, front, left] = footprintCorners(f);
  const up = (p: Point, height = WALL_HEIGHT) => ({ x: p.x, y: p.y - height });
  const ridgeBack = up(
    { x: (back.x + right.x) / 2, y: (back.y + right.y) / 2 },
    WALL_HEIGHT + ROOF_RISE,
  );
  return [left, front, right, up(right), ridgeBack, up(back), up(left)];
}

/** World point just above the middle of the greenhouse's ridge, for its name tag. */
export function greenhouseLabelAnchor(layout: SceneLayout): Point {
  const { i, j, width, length } = layout.greenhouse;
  const middle = gridToWorld(i + width / 2, j + length / 2);
  return { x: middle.x, y: middle.y - WALL_HEIGHT - ROOF_RISE - 10 };
}

/** World bounding box of the lot. */
export function lotBounds(layout: SceneLayout): Rect {
  return footprintBounds(layout.lot);
}

/** How far inside the fence the camera centre stops, in tiles. */
const CAMERA_MARGIN = 2;

/**
 * Keeps the camera centre over the lot (a diamond on screen), a little
 * inside the fence, so the land beyond only shows at the screen's edge.
 */
export function clampToLot(layout: SceneLayout): (p: Point) => Point {
  const { i, j, width, length } = layout.lot;
  const m = CAMERA_MARGIN;
  return (p) => {
    const g = worldToGrid(p);
    return gridToWorld(
      Math.min(i + width - m, Math.max(i + m, g.i)),
      Math.min(j + length - m, Math.max(j + m, g.j)),
    );
  };
}

/** World bounding box of the greenhouse, walls and roof included. */
export function greenhouseBounds(layout: SceneLayout): Rect {
  const rect = footprintBounds(layout.greenhouse);
  return { ...rect, minY: rect.minY - WALL_HEIGHT * 1.8 };
}

/** World bounding box of the greenhouse and every building, for the first view. */
export function yardBounds(layout: SceneLayout): Rect {
  return layout.buildings.reduce((rect, { footprint, height }) => {
    const b = footprintBounds(footprint);
    return {
      minX: Math.min(rect.minX, b.minX),
      maxX: Math.max(rect.maxX, b.maxX),
      minY: Math.min(rect.minY, b.minY - height),
      maxY: Math.max(rect.maxY, b.maxY),
    };
  }, greenhouseBounds(layout));
}

function footprintBounds(f: Footprint): Rect {
  const [back, right, front, left] = footprintCorners(f);
  return { minX: left.x, maxX: right.x, minY: back.y, maxY: front.y };
}
