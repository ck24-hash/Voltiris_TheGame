import type { Graphics } from 'pixi.js';
import type { Point } from '../../iso/projection';

export function flat(points: readonly Point[]): number[] {
  return points.flatMap((p) => [p.x, p.y]);
}

export function lift(p: Point, height: number): Point {
  return { x: p.x, y: p.y - height };
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
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
