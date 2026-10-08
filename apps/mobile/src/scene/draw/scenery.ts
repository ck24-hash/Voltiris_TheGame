import type { Graphics } from 'pixi.js';
import type { Point } from '../../iso/projection';
import type { FenceSegment, Scenery, StandingKind } from '../../iso/scenery';
import { COLORS } from '../palette';
import { at, INK, lift, toonCircle } from './shapes';

// Standing scenery, drawn in world coordinates at its grid position.

function shadow(g: Graphics, p: Point, rx: number): void {
  g.ellipse(p.x + rx * 0.2, p.y + 1, rx, rx * 0.38).fill({
    color: COLORS.shadow,
    alpha: 0.16,
  });
}

export function drawStanding(g: Graphics, s: Scenery<StandingKind>): void {
  const p = at(s.i, s.j);
  const size = 0.8 + 0.45 * s.variant;
  switch (s.kind) {
    case 'tree':
      return drawTree(g, p, size, s.variant);
    case 'pine':
      return drawPine(g, p, size);
    case 'bush':
      return drawBush(g, p, size, s.variant);
    case 'rock':
      return drawRock(g, p, size);
    case 'mailbox':
      return drawMailbox(g, p);
  }
}

function drawTree(g: Graphics, p: Point, s: number, variant: number): void {
  shadow(g, p, 30 * s);
  g.rect(p.x - 4 * s, p.y - 28 * s, 8 * s, 28 * s)
    .fill(COLORS.trunk)
    .stroke({ color: COLORS.trunkDark, width: 2 });
  const leaf = variant < 0.5 ? COLORS.canopy : COLORS.canopyAlt;
  for (const [dx, dy, r] of [
    [-13, -36, 16],
    [13, -38, 15],
    [0, -54, 21],
  ] as const) {
    toonCircle(g, p.x + dx * s, p.y + dy * s, r * s, leaf, COLORS.leafLine);
  }
  g.circle(p.x - 7 * s, p.y - 60 * s, 7 * s).fill(COLORS.canopyLight);
}

function drawPine(g: Graphics, p: Point, s: number): void {
  shadow(g, p, 22 * s);
  g.rect(p.x - 3 * s, p.y - 14 * s, 6 * s, 14 * s)
    .fill(COLORS.trunk)
    .stroke({ color: COLORS.trunkDark, width: 2 });
  for (const [bottom, top, half] of [
    [12, 44, 24],
    [32, 64, 19],
    [50, 82, 13],
  ] as const) {
    g.poly([
      p.x - half * s,
      p.y - bottom * s,
      p.x + half * s,
      p.y - bottom * s,
      p.x,
      p.y - top * s,
    ])
      .fill(COLORS.pine)
      .stroke({ color: COLORS.leafLine, width: 2, join: 'round' });
  }
}

function drawBush(g: Graphics, p: Point, s: number, variant: number): void {
  shadow(g, p, 20 * s);
  for (const [dx, dy, r] of [
    [-9, -9, 10],
    [9, -9, 10],
    [0, -16, 12],
  ] as const) {
    toonCircle(
      g,
      p.x + dx * s,
      p.y + dy * s,
      r * s,
      COLORS.bush,
      COLORS.leafLine,
    );
  }
  if (variant > 0.7) {
    for (const [dx, dy] of [
      [-8, -12],
      [6, -18],
      [9, -8],
    ] as const) {
      g.circle(p.x + dx * s, p.y + dy * s, 2.5).fill(COLORS.signRed);
    }
  }
}

function drawRock(g: Graphics, p: Point, s: number): void {
  shadow(g, p, 15 * s);
  g.poly([
    p.x - 15 * s,
    p.y,
    p.x - 10 * s,
    p.y - 11 * s,
    p.x + 2 * s,
    p.y - 15 * s,
    p.x + 14 * s,
    p.y - 7 * s,
    p.x + 13 * s,
    p.y + 2 * s,
  ])
    .fill(COLORS.rock)
    .stroke({ color: COLORS.rockLine, width: 2, join: 'round' });
  g.poly([
    p.x + 2 * s,
    p.y - 15 * s,
    p.x + 14 * s,
    p.y - 7 * s,
    p.x + 13 * s,
    p.y + 2 * s,
    p.x + 3 * s,
    p.y + 1 * s,
  ]).fill(COLORS.rockDark);
}

function drawMailbox(g: Graphics, p: Point): void {
  shadow(g, p, 9);
  g.rect(p.x - 2, p.y - 26, 4, 26).fill(COLORS.woodDark);
  g.roundRect(p.x - 10, p.y - 40, 20, 14, 5)
    .fill(COLORS.mailbox)
    .stroke(INK);
  g.rect(p.x + 6, p.y - 48, 2.5, 10).fill(COLORS.ink);
  g.rect(p.x + 8.5, p.y - 48, 6, 4).fill(COLORS.bolt);
}

/** A tile of wooden fence: two rails between two posts. */
export function drawFence(g: Graphics, { from, to }: FenceSegment): void {
  const a = at(from.i, from.j);
  const b = at(to.i, to.j);
  for (const h of [9, 17]) {
    const p = lift(a, h);
    const q = lift(b, h);
    g.moveTo(p.x, p.y)
      .lineTo(q.x, q.y)
      .stroke({ color: COLORS.fenceDark, width: 5, cap: 'round' });
    g.moveTo(p.x, p.y)
      .lineTo(q.x, q.y)
      .stroke({ color: COLORS.fence, width: 2.5, cap: 'round' });
  }
  for (const p of [a, b]) {
    g.roundRect(p.x - 3, p.y - 23, 6, 24, 2)
      .fill(COLORS.fence)
      .stroke({ color: COLORS.fenceDark, width: 1.5 });
  }
}

/** Post and board of a "For sale" sign; the scene adds the words. */
export function drawSignBoard(g: Graphics, p: Point): void {
  shadow(g, p, 30);
  for (const dx of [-24, 24]) {
    g.rect(p.x + dx - 2.5, p.y - 34, 5, 34).fill(COLORS.woodDark);
  }
  g.roundRect(p.x - 44, p.y - 66, 88, 34, 6)
    .fill(COLORS.signBoard)
    .stroke({ color: COLORS.signRed, width: 3 });
}

/** Where the words go on a sign standing at `p`. */
export function signTextCenter(p: Point): Point {
  return { x: p.x, y: p.y - 49 };
}
