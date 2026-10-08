import type { Graphics } from 'pixi.js';
import type { SceneLayout } from '../../iso/layout';
import { gridToWorld, tileCorners } from '../../iso/projection';
import { COLORS } from '../palette';
import { flat, lift } from './shapes';

const CLIFF_DEPTH = 22;

/** Grass checkerboard on a floating island with earthy sides. */
export function drawGround(g: Graphics, layout: SceneLayout): void {
  const n = layout.groundSize;
  g.clear();

  const left = gridToWorld(0, n);
  const bottom = gridToWorld(n, n);
  const right = gridToWorld(n, 0);
  g.poly(
    flat([left, bottom, lift(bottom, -CLIFF_DEPTH), lift(left, -CLIFF_DEPTH)]),
  ).fill(COLORS.cliffLight);
  g.poly(
    flat([
      bottom,
      right,
      lift(right, -CLIFF_DEPTH),
      lift(bottom, -CLIFF_DEPTH),
    ]),
  ).fill(COLORS.cliffDark);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      g.poly(flat(tileCorners({ i, j }))).fill(
        (i + j) % 2 === 0 ? COLORS.grassA : COLORS.grassB,
      );
    }
  }
}
