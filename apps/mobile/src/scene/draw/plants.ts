import type { CropId } from '@voltiris/content';
import type { Graphics } from 'pixi.js';
import { TILE_HEIGHT, TILE_WIDTH } from '../../iso/projection';
import { COLORS } from '../palette';
import { toonCircle } from './shapes';

// All shapes are drawn around the plot's tile centre (0, 0); plants grow up (−y).

const HALF_W = TILE_WIDTH / 2;
const HALF_H = TILE_HEIGHT / 2;

/** Soil bed, plus a highlight when the plot is selected. */
export function drawPlot(g: Graphics, selected: boolean): void {
  g.clear();
  const bed = (scale: number) => [
    0,
    -HALF_H * scale,
    HALF_W * scale,
    0,
    0,
    HALF_H * scale,
    -HALF_W * scale,
    0,
  ];
  g.poly(bed(0.8))
    .fill(COLORS.soil)
    .stroke({ color: COLORS.soilRim, width: 3 });
  g.poly(bed(0.55)).fill(COLORS.soilDark);
  if (selected) {
    g.poly(bed(0.98)).stroke({
      color: COLORS.highlight,
      width: 5,
      join: 'round',
    });
  }
}

export interface PlantLook {
  readonly cropId: CropId;
  /** 0–1, already rounded to a few steps so redraws stay rare. */
  readonly progress: number;
  readonly ready: boolean;
}

const SEEDLING_BELOW = 0.12;
const FRUIT_FROM = 0.55;

export function drawPlant(g: Graphics, look: PlantLook): void {
  g.clear();
  g.ellipse(0, 4, 24, 9).fill({ color: COLORS.shadow, alpha: 0.15 });

  if (!look.ready && look.progress < SEEDLING_BELOW) {
    drawSeedling(g);
    return;
  }
  const growth = look.ready ? 1 : look.progress;
  switch (look.cropId) {
    case 'tomato':
      drawVine(g, growth, look.ready, 'tomato');
      break;
    case 'cucumber':
      drawVine(g, growth, look.ready, 'cucumber');
      break;
    case 'pepper':
      drawPepper(g, growth, look.ready);
      break;
  }
}

function drawSeedling(g: Graphics): void {
  g.moveTo(0, 0).lineTo(0, -14).stroke({ color: COLORS.leafOutline, width: 3 });
  toonCircle(g, -6, -15, 5, COLORS.leafLight, COLORS.leafOutline);
  toonCircle(g, 6, -15, 5, COLORS.leafLight, COLORS.leafOutline);
}

/** Tomatoes and cucumbers: vines trained up a stake. */
function drawVine(
  g: Graphics,
  growth: number,
  ready: boolean,
  crop: 'tomato' | 'cucumber',
): void {
  const height = 26 + 66 * growth;
  const leafRadius = (crop === 'cucumber' ? 10 : 8) + 4 * growth;
  const leaves = 2 + Math.round(growth * 4);

  g.rect(-2, -height - 8, 4, height + 8).fill(COLORS.stake);
  for (let k = 0; k < leaves; k++) {
    const y = -height * ((k + 1) / (leaves + 1));
    const side = k % 2 === 0 ? -1 : 1;
    toonCircle(g, side * 9, y, leafRadius, COLORS.leaf, COLORS.leafOutline);
  }
  toonCircle(
    g,
    0,
    -height,
    leafRadius * 0.9,
    COLORS.leafLight,
    COLORS.leafOutline,
  );

  if (crop === 'cucumber' && growth > 0.35 && !ready) {
    for (const [x, y] of [
      [-12, 0.45],
      [12, 0.7],
    ] as const) {
      g.circle(x, -height * y, 3.5).fill(COLORS.flower);
    }
  }

  if (growth < FRUIT_FROM) return;
  const fruitScale = ready ? 1 : 0.7;
  const positions = [
    [-12, 0.3],
    [11, 0.48],
    [-10, 0.66],
  ] as const;
  for (const [x, y] of positions) {
    if (crop === 'tomato') {
      const color = ready ? COLORS.tomato : COLORS.unripe;
      for (const dx of [-4, 4]) {
        toonCircle(
          g,
          x + dx,
          -height * y,
          5 * fruitScale,
          color,
          COLORS.leafOutline,
        );
      }
    } else {
      g.ellipse(x, -height * y + 6, 3.5 * fruitScale, 10 * fruitScale)
        .fill(ready ? COLORS.cucumber : COLORS.unripe)
        .stroke({ color: COLORS.leafOutline, width: 2 });
    }
  }
}

/** Peppers: a round bush with bell-shaped fruit. */
function drawPepper(g: Graphics, growth: number, ready: boolean): void {
  const radius = 9 + 13 * growth;
  const centerY = -radius - 4;
  toonCircle(
    g,
    -radius * 0.6,
    centerY + 4,
    radius * 0.75,
    COLORS.leaf,
    COLORS.leafOutline,
  );
  toonCircle(
    g,
    radius * 0.6,
    centerY + 4,
    radius * 0.75,
    COLORS.leaf,
    COLORS.leafOutline,
  );
  toonCircle(
    g,
    0,
    centerY - radius * 0.35,
    radius * 0.85,
    COLORS.leafLight,
    COLORS.leafOutline,
  );

  if (growth < FRUIT_FROM) return;
  const size = ready ? 1 : 0.7;
  const color = ready ? COLORS.pepper : COLORS.unripe;
  for (const [x, y] of [
    [-radius * 0.55, centerY + 6],
    [radius * 0.5, centerY + 2],
    [0, centerY - 6],
  ] as const) {
    g.roundRect(x - 5 * size, y - 6 * size, 10 * size, 13 * size, 4 * size)
      .fill(color)
      .stroke({ color: COLORS.leafOutline, width: 2 });
  }
}
