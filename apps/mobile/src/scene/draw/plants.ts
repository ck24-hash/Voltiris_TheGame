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
const SEEDLING_HEIGHT = 20;
const FRUIT_FROM = 0.55;

const vineHeight = (growth: number) => 26 + 66 * growth;
const pepperRadius = (growth: number) => 9 + 13 * growth;
const strawberryRadius = (growth: number) => 8 + 9 * growth;
const shootHeight = (growth: number) => 4 + 12 * growth;

/** Microgreens are a tray of shoots from the start, not a seedling. */
const isSeedling = (look: PlantLook) =>
  look.cropId !== 'microgreens' &&
  !look.ready &&
  look.progress < SEEDLING_BELOW;

/** How far the drawn plant reaches above its tile centre; used for tap targets. */
export function plantHeight(look: PlantLook): number {
  if (isSeedling(look)) return SEEDLING_HEIGHT;
  const growth = look.ready ? 1 : look.progress;
  switch (look.cropId) {
    case 'microgreens':
      return shootHeight(growth) + 10;
    case 'strawberry':
      return 2 * strawberryRadius(growth) + 6;
    case 'pepper':
      return 2.2 * pepperRadius(growth) + 4;
    case 'cucumber':
    case 'tomato':
      return vineHeight(growth) + 12;
  }
}

export function drawPlant(g: Graphics, look: PlantLook): void {
  g.clear();
  g.ellipse(0, 4, 24, 9).fill({ color: COLORS.shadow, alpha: 0.15 });

  if (isSeedling(look)) {
    drawSeedling(g);
    return;
  }
  const growth = look.ready ? 1 : look.progress;
  switch (look.cropId) {
    case 'microgreens':
      drawMicrogreens(g, growth);
      break;
    case 'strawberry':
      drawStrawberry(g, growth, look.ready);
      break;
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

/** A seed tray of shoots that thicken into a green carpet. */
function drawMicrogreens(g: Graphics, growth: number): void {
  const tray = [0, -10, 20, 0, 0, 10, -20, 0];
  g.poly(tray.map((v, k) => (k % 2 === 1 ? v - 4 : v)))
    .fill(COLORS.tray)
    .stroke({ color: COLORS.trayDark, width: 2 });
  const height = shootHeight(growth);
  const leaf = 2 + 2.5 * growth;
  for (const { x, y } of SHOOTS) {
    g.moveTo(x, y)
      .lineTo(x, y - height)
      .stroke({ color: COLORS.shoot, width: 1.5 });
    for (const side of [-0.7, 0.7]) {
      toonCircle(
        g,
        x + side * leaf,
        y - height,
        leaf,
        COLORS.leafLight,
        COLORS.leafOutline,
      );
    }
  }
}

/** Where the shoots stand in the tray, back to front so nearer ones overlap. */
const SHOOTS = [-2, -1, 0, 1, 2]
  .flatMap((row) => [-2, -1, 0, 1, 2].map((col) => ({ row, col })))
  .filter(({ row, col }) => Math.abs(row) + Math.abs(col) <= 3)
  .sort((a, b) => a.row + a.col - (b.row + b.col))
  .map(({ row, col }) => ({ x: (col - row) * 4.5, y: (col + row) * 2.2 - 4 }));

/** A low strawberry plant: leaves, then white flowers, then hanging berries. */
function drawStrawberry(g: Graphics, growth: number, ready: boolean): void {
  const radius = strawberryRadius(growth);
  const centerY = -radius;
  for (const [x, y, r] of [
    [-radius * 0.65, centerY + 3, 0.7],
    [radius * 0.65, centerY + 3, 0.7],
    [0, centerY - radius * 0.3, 0.8],
  ] as const) {
    toonCircle(g, x, y, radius * r, COLORS.leaf, COLORS.leafOutline);
  }
  if (growth < 0.35) return;
  if (!ready && growth < FRUIT_FROM) {
    for (const [x, y] of [
      [-radius * 0.5, centerY - 2],
      [radius * 0.45, centerY + 1],
    ] as const) {
      toonCircle(g, x, y, 3.5, COLORS.blossom, COLORS.leafOutline);
      g.circle(x, y, 1.3).fill(COLORS.flower);
    }
    return;
  }
  const size = ready ? 1 : 0.75;
  const color = ready ? COLORS.strawberry : COLORS.unripe;
  for (const [x, y] of [
    [-radius * 0.75, centerY + radius * 0.6],
    [radius * 0.2, centerY + radius * 0.75],
    [radius * 0.8, centerY + radius * 0.45],
  ] as const) {
    g.poly([
      x - 4.5 * size,
      y - 3 * size,
      x + 4.5 * size,
      y - 3 * size,
      x,
      y + 6 * size,
    ])
      .fill(color)
      .stroke({ color: COLORS.leafOutline, width: 2, join: 'round' });
    g.circle(x, y - 3.5 * size, 2).fill(COLORS.leaf);
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
  const height = vineHeight(growth);
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
  const radius = pepperRadius(growth);
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
