import type { Graphics } from 'pixi.js';
import { ROOF_RISE, WALL_HEIGHT, type Footprint } from '../../iso/layout';
import { gridToWorld, type Point } from '../../iso/projection';
import { COLORS } from '../palette';
import { flat, lerp, lift } from './shapes';

const FRAME = { color: COLORS.frame, width: 3, alpha: 0.95 } as const;

/** Glass by level: single, double (a little bluer), diffuse (milky). */
const GLASS_LOOKS = [
  { color: COLORS.glass, dark: COLORS.glassDark, extra: 0 },
  { color: COLORS.glassDouble, dark: COLORS.glassDark, extra: 0.06 },
  { color: COLORS.glassDiffuse, dark: COLORS.glassDiffuseDark, extra: 0.12 },
] as const;

function glassLook(level: number) {
  return GLASS_LOOKS[level - 1] ?? GLASS_LOOKS[0];
}

/** Corners at ground level: a = back, b = right, c = front, d = left. */
export function greenhouseCorners(f: Footprint) {
  const a = gridToWorld(f.i, f.j);
  const b = gridToWorld(f.i + f.width, f.j);
  const c = gridToWorld(f.i + f.width, f.j + f.length);
  const d = gridToWorld(f.i, f.j + f.length);
  // The gable roof's ridge runs along the greenhouse's length (j axis).
  const ridgeBack = lift(lerp(a, b, 0.5), WALL_HEIGHT + ROOF_RISE);
  const ridgeFront = lift(lerp(d, c, 0.5), WALL_HEIGHT + ROOF_RISE);
  return { a, b, c, d, ridgeBack, ridgeFront };
}

function glassWall(
  g: Graphics,
  from: Point,
  to: Point,
  color: number,
  alpha: number,
): void {
  g.poly(flat([from, to, lift(to, WALL_HEIGHT), lift(from, WALL_HEIGHT)])).fill(
    { color, alpha },
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
export function drawGreenhouseBack(
  g: Graphics,
  f: Footprint,
  glass: number,
): void {
  const { a, b, c, d, ridgeBack } = greenhouseCorners(f);
  const look = glassLook(glass);
  g.clear();

  g.poly(flat([a, b, c, d]))
    .fill(COLORS.floor)
    .stroke({ color: COLORS.floorEdge, width: 3 });

  glassWall(g, a, b, look.color, 0.4 + look.extra);
  glassWall(g, a, d, look.color, 0.4 + look.extra);
  g.poly(flat([lift(a, WALL_HEIGHT), lift(b, WALL_HEIGHT), ridgeBack])).fill({
    color: look.color,
    alpha: 0.4 + look.extra,
  });

  mullions(g, a, b, f.width);
  mullions(g, a, d, f.length);
}

/**
 * Front walls, roof, roof vents and door: drawn over the plants, mostly
 * see-through. `vents` is 0 without roof vents; `ventOpening` 0–1.
 */
export function drawGreenhouseFront(
  g: Graphics,
  f: Footprint,
  glass: number,
  vents: number,
  ventOpening: number,
): void {
  const { a, b, c, d, ridgeBack, ridgeFront } = greenhouseCorners(f);
  const look = glassLook(glass);
  const top = (p: Point) => lift(p, WALL_HEIGHT);
  g.clear();

  glassWall(g, b, c, look.color, 0.18 + look.extra);
  glassWall(g, d, c, look.color, 0.18 + look.extra);

  // Door on the front-left wall.
  const doorFrom = lerp(d, c, 0.4);
  const doorTo = lerp(d, c, 0.6);
  g.poly(flat([doorFrom, doorTo, lift(doorTo, 72), lift(doorFrom, 72)]))
    .fill({ color: COLORS.glassDark, alpha: 0.55 })
    .stroke(FRAME);

  // Front gable and the two roof planes.
  // Two shades so the roof's shape reads, light enough to see the plants.
  g.poly(flat([top(d), top(c), ridgeFront])).fill({
    color: look.color,
    alpha: 0.3 + look.extra,
  });
  g.poly(flat([top(a), top(d), ridgeFront, ridgeBack])).fill({
    color: look.color,
    alpha: 0.3 + look.extra,
  });
  g.poly(flat([top(b), top(c), ridgeFront, ridgeBack])).fill({
    color: look.dark,
    alpha: 0.32 + look.extra,
  });

  // Roof vents: flaps along the ridge on the right roof plane, lifted as far
  // as they are open.
  if (vents > 0) {
    const onRightPlane = (along: number, down: number) =>
      lerp(
        lerp(ridgeBack, ridgeFront, along),
        lerp(top(b), top(c), along),
        down,
      );
    const lifted = 2 + 16 * ventOpening;
    for (const start of [0.18, 0.58]) {
      const end = start + 0.22;
      g.poly(
        flat([
          onRightPlane(start, 0.08),
          onRightPlane(end, 0.08),
          lift(onRightPlane(end, 0.32), lifted),
          lift(onRightPlane(start, 0.32), lifted),
        ]),
      )
        .fill({ color: COLORS.glassDark, alpha: 0.7 })
        .stroke(FRAME);
    }
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
