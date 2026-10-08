import type { Graphics } from 'pixi.js';
import { WALL_HEIGHT, type Footprint } from '../../iso/layout';
import { gridToWorld, type Point } from '../../iso/projection';
import { COLORS } from '../palette';
import { flat, lerp, lift } from './shapes';

const ROOF_RISE = 64;
const FRAME = { color: COLORS.frame, width: 3, alpha: 0.95 } as const;

/** Corners at ground level: a = back, b = right, c = front, d = left. */
function corners(f: Footprint) {
  const a = gridToWorld(f.i, f.j);
  const b = gridToWorld(f.i + f.width, f.j);
  const c = gridToWorld(f.i + f.width, f.j + f.length);
  const d = gridToWorld(f.i, f.j + f.length);
  // The gable roof's ridge runs along the greenhouse's length (j axis).
  const ridgeBack = lift(lerp(a, b, 0.5), WALL_HEIGHT + ROOF_RISE);
  const ridgeFront = lift(lerp(d, c, 0.5), WALL_HEIGHT + ROOF_RISE);
  return { a, b, c, d, ridgeBack, ridgeFront };
}

function glassWall(g: Graphics, from: Point, to: Point, alpha: number): void {
  g.poly(flat([from, to, lift(to, WALL_HEIGHT), lift(from, WALL_HEIGHT)])).fill(
    {
      color: COLORS.glass,
      alpha,
    },
  );
}

/** Vertical glazing bars along a wall, one per tile. */
function mullions(g: Graphics, from: Point, to: Point, tiles: number): void {
  for (let k = 0; k <= tiles; k++) {
    const p = lerp(from, to, k / tiles);
    g.moveTo(p.x, p.y).lineTo(p.x, p.y - WALL_HEIGHT);
  }
  g.moveTo(from.x, from.y - WALL_HEIGHT).lineTo(to.x, to.y - WALL_HEIGHT);
  g.stroke(FRAME);
}

/** Floor, back walls and back gable: drawn behind the plants. */
export function drawGreenhouseBack(g: Graphics, f: Footprint): void {
  const { a, b, c, d, ridgeBack } = corners(f);
  g.clear();

  g.poly(flat([a, b, c, d]))
    .fill(COLORS.floor)
    .stroke({ color: COLORS.floorEdge, width: 3 });

  glassWall(g, a, b, 0.4);
  glassWall(g, a, d, 0.4);
  g.poly(flat([lift(a, WALL_HEIGHT), lift(b, WALL_HEIGHT), ridgeBack])).fill({
    color: COLORS.glass,
    alpha: 0.4,
  });

  mullions(g, a, b, f.width);
  mullions(g, a, d, f.length);
}

/** Front walls, roof, vents and door: drawn over the plants, mostly see-through. */
export function drawGreenhouseFront(g: Graphics, f: Footprint): void {
  const { a, b, c, d, ridgeBack, ridgeFront } = corners(f);
  const top = (p: Point) => lift(p, WALL_HEIGHT);
  g.clear();

  glassWall(g, b, c, 0.18);
  glassWall(g, d, c, 0.18);

  // Door on the front-left wall.
  const doorFrom = lerp(d, c, 0.4);
  const doorTo = lerp(d, c, 0.6);
  g.poly(flat([doorFrom, doorTo, lift(doorTo, 72), lift(doorFrom, 72)]))
    .fill({ color: COLORS.glassDark, alpha: 0.55 })
    .stroke(FRAME);

  // Front gable and the two roof planes.
  // Two shades so the roof's shape reads, light enough to see the plants.
  g.poly(flat([top(d), top(c), ridgeFront])).fill({
    color: COLORS.glass,
    alpha: 0.3,
  });
  g.poly(flat([top(a), top(d), ridgeFront, ridgeBack])).fill({
    color: COLORS.glass,
    alpha: 0.3,
  });
  g.poly(flat([top(b), top(c), ridgeFront, ridgeBack])).fill({
    color: COLORS.glassDark,
    alpha: 0.32,
  });

  // Roof vents: open flaps along the ridge on the right roof plane.
  const onRightPlane = (along: number, down: number) =>
    lerp(lerp(ridgeBack, ridgeFront, along), lerp(top(b), top(c), along), down);
  for (const start of [0.18, 0.58]) {
    const end = start + 0.22;
    g.poly(
      flat([
        onRightPlane(start, 0.08),
        onRightPlane(end, 0.08),
        lift(onRightPlane(end, 0.32), 10),
        lift(onRightPlane(start, 0.32), 10),
      ]),
    )
      .fill({ color: COLORS.glassDark, alpha: 0.7 })
      .stroke(FRAME);
  }

  mullions(g, b, c, f.length);
  mullions(g, d, c, f.width);
  g.moveTo(ridgeBack.x, ridgeBack.y)
    .lineTo(ridgeFront.x, ridgeFront.y)
    .moveTo(top(d).x, top(d).y)
    .lineTo(ridgeFront.x, ridgeFront.y)
    .lineTo(top(c).x, top(c).y)
    .moveTo(top(a).x, top(a).y)
    .lineTo(ridgeBack.x, ridgeBack.y)
    .lineTo(top(b).x, top(b).y)
    .stroke(FRAME);
}
