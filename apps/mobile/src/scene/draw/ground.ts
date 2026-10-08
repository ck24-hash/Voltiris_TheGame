import type { Graphics } from 'pixi.js';
import type { Footprint, SceneLayout } from '../../iso/layout';
import {
  neighbourField,
  noise,
  type FlatKind,
  type Scenery,
} from '../../iso/scenery';
import { COLORS } from '../palette';
import { at, flat } from './shapes';

// Everything flat on the ground, drawn once under all standing objects. The
// meadow itself is the renderer's background colour, so the land never ends.

/** How far the road is drawn each way past the lot, in tiles. */
const ROAD_REACH = 80;
/** How far meadow patches are drawn around the lot, in tiles. */
const PATCH_REACH = 24;

function area(g: Graphics, f: Footprint, fill: number): Graphics {
  const { i, j, width: w, length: l } = f;
  return g
    .poly(flat([at(i, j), at(i + w, j), at(i + w, j + l), at(i, j + l)]))
    .fill(fill);
}

export function drawGround(
  g: Graphics,
  layout: SceneLayout,
  details: readonly Scenery<FlatKind>[],
): void {
  g.clear();
  drawMeadowPatches(g, layout);
  drawField(g, neighbourField(layout));
  drawRoad(g, layout);
  drawLot(g, layout);
  drawPath(g, layout.path);
  for (const { footprint } of layout.buildings) drawPad(g, footprint);
  drawPad(g, layout.greenhouse);
  for (const detail of details) drawDetail(g, detail);
}

/** Soft lighter and darker patches, so the meadow is not one flat colour. */
function drawMeadowPatches(g: Graphics, { lot }: SceneLayout): void {
  for (
    let i = lot.i - PATCH_REACH;
    i < lot.i + lot.width + PATCH_REACH;
    i += 3
  ) {
    for (
      let j = lot.j - PATCH_REACH;
      j < lot.j + lot.length + PATCH_REACH;
      j += 3
    ) {
      if (noise(i, j, 7) > 0.4) continue;
      const p = at(i + 3 * noise(i, j, 8), j + 3 * noise(i, j, 9));
      const radius = 50 + 70 * noise(i, j, 10);
      const color =
        noise(i, j, 11) < 0.5 ? COLORS.meadowDark : COLORS.meadowLight;
      g.ellipse(p.x, p.y, radius, radius / 2).fill({ color, alpha: 0.55 });
    }
  }
}

function drawField(g: Graphics, field: Footprint): void {
  area(g, field, COLORS.fieldSoil);
  const rows = field.length * 2;
  for (let r = 0; r < rows; r++) {
    const j = field.j + r / 2;
    if (r % 2 === 1) {
      area(
        g,
        { i: field.i, j, width: field.width, length: 0.5 },
        COLORS.fieldRow,
      );
      continue;
    }
    for (let i = field.i + 0.25; i < field.i + field.width; i += 0.5) {
      const p = at(i, j + 0.25);
      g.circle(p.x, p.y - 4, 6 + 2 * noise(i * 2, r, 12)).fill(
        COLORS.fieldCrop,
      );
    }
  }
}

function drawRoad(g: Graphics, { lot, road }: SceneLayout): void {
  const i0 = lot.i - ROAD_REACH;
  const i1 = lot.i + lot.width + ROAD_REACH;
  const band = (j0: number, j1: number) => ({
    i: i0,
    j: j0,
    width: i1 - i0,
    length: j1 - j0,
  });
  area(g, band(road.j0 - 0.12, road.j1 + 0.12), COLORS.roadEdge);
  area(g, band(road.j0, road.j1), COLORS.road);
  const middle = (road.j0 + road.j1) / 2;
  for (let i = i0; i < i1; i++) {
    const from = at(i + 0.15, middle);
    const to = at(i + 0.65, middle);
    g.moveTo(from.x, from.y).lineTo(to.x, to.y);
  }
  g.stroke({ color: COLORS.roadLine, width: 5, cap: 'round' });
}

/** The owned lot: freshly mown lawn in stripes. */
function drawLot(g: Graphics, { lot }: SceneLayout): void {
  area(g, lot, COLORS.lawn);
  for (let i = lot.i; i < lot.i + lot.width; i += 2) {
    area(g, { i, j: lot.j, width: 1, length: lot.length }, COLORS.lawnStripe);
  }
}

function drawPath(g: Graphics, path: Footprint): void {
  area(g, path, COLORS.path);
  for (let j = path.j + 0.4; j < path.j + path.length - 0.2; j += 0.75) {
    const p = at(path.i + path.width / 2, j);
    g.ellipse(p.x, p.y, 18, 9).fill(COLORS.pathStone);
  }
}

/** Gravel under a building. */
function drawPad(g: Graphics, f: Footprint): void {
  const m = 0.12;
  const { i, j, width: w, length: l } = f;
  g.poly(
    flat([
      at(i - m, j - m),
      at(i + w + m, j - m),
      at(i + w + m, j + l + m),
      at(i - m, j + l + m),
    ]),
  )
    .fill(COLORS.pad)
    .stroke({ color: COLORS.padEdge, width: 2 });
}

function drawDetail(
  g: Graphics,
  { kind, i, j, variant }: Scenery<FlatKind>,
): void {
  const p = at(i, j);
  if (kind === 'tuft') {
    g.moveTo(p.x - 5, p.y)
      .lineTo(p.x - 8, p.y - 9)
      .moveTo(p.x, p.y)
      .lineTo(p.x, p.y - 12)
      .moveTo(p.x + 5, p.y)
      .lineTo(p.x + 8, p.y - 9)
      .stroke({ color: COLORS.tuft, width: 2.5, cap: 'round' });
    return;
  }
  const color =
    COLORS.flowers[Math.floor(variant * COLORS.flowers.length)] ?? 0xffffff;
  for (const [dx, dy] of [
    [-6, 0],
    [5, -3],
    [0, 4],
  ] as const) {
    g.circle(p.x + dx, p.y + dy, 3.2).fill(color);
    g.circle(p.x + dx, p.y + dy, 1.2).fill(COLORS.flower);
  }
}
