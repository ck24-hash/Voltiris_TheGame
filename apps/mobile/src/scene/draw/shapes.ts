import type { Graphics } from 'pixi.js';
import type { Footprint } from '../../iso/layout';
import { gridToWorld, type Point } from '../../iso/projection';
import { COLORS } from '../palette';

export function flat(points: readonly Point[]): number[] {
  return points.flatMap((p) => [p.x, p.y]);
}

export function lift(p: Point, height: number): Point {
  return { x: p.x, y: p.y - height };
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** World point of grid position (i, j), `height` pixels above the ground. */
export function at(i: number, j: number, height = 0): Point {
  return lift(gridToWorld(i, j), height);
}

export function toonCircle(
  g: Graphics,
  x: number,
  y: number,
  radius: number,
  fill: number,
  outline: number,
): void {
  g.circle(x, y, radius).fill(fill).stroke({ color: outline, width: 2 });
}

export const INK = { color: COLORS.ink, width: 2, join: 'round' } as const;

export interface BoxColors {
  /** The wall facing down-left (+j), in the light. */
  readonly left: number;
  /** The wall facing down-right (+i), in shade. */
  readonly right: number;
  readonly top: number;
}

/** An isometric box on `f`, from `base` to `base + height` pixels up. */
export function isoBox(
  g: Graphics,
  f: Footprint,
  height: number,
  colors: BoxColors,
  base = 0,
): void {
  const { i, j, width, length } = f;
  const back = at(i, j, base);
  const right = at(i + width, j, base);
  const front = at(i + width, j + length, base);
  const left = at(i, j + length, base);
  const up = (p: Point) => lift(p, height);
  g.poly(flat([left, front, up(front), up(left)]))
    .fill(colors.left)
    .stroke(INK);
  g.poly(flat([front, right, up(right), up(front)]))
    .fill(colors.right)
    .stroke(INK);
  g.poly(flat([up(back), up(right), up(front), up(left)]))
    .fill(colors.top)
    .stroke(INK);
}

/**
 * A point on the front (+j) wall of footprint `f`: `u` runs 0–1 from its left
 * corner to its front corner, `v` is the height in pixels.
 */
export function onFrontWall(f: Footprint, u: number, v: number): Point {
  return at(f.i + f.width * u, f.j + f.length, v);
}

/** A traffic cone: the building is still under construction. */
export function cone(g: Graphics, p: Point): void {
  g.ellipse(p.x, p.y + 1, 9, 4).fill({ color: COLORS.shadow, alpha: 0.18 });
  g.poly([p.x - 8, p.y, p.x + 8, p.y, p.x + 3, p.y - 20, p.x - 3, p.y - 20])
    .fill(COLORS.cone)
    .stroke(INK);
  g.rect(p.x - 5.5, p.y - 12, 11, 4).fill(0xffffff);
}
