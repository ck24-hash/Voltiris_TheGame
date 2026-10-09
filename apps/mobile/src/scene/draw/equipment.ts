import type { EquipmentKind } from '@voltiris/content';
import type { Graphics } from 'pixi.js';
import { WALL_HEIGHT, type SceneLayout } from '../../iso/layout';
import { tileCenter, type Point } from '../../iso/projection';
import { COLORS } from '../palette';
import { greenhouseCorners } from './greenhouse';
import { at, INK, lerp, lift, toonCircle } from './shapes';

// Placeholder toon shapes of the greenhouse equipment. Floor-standing devices
// stand along the back walls (drawn before the plants); lamps and fog hang
// above the plants (drawn after them, under the front glass).

/** What the scene shows of a greenhouse's equipment. */
export interface EquipmentLook {
  /** Level of each device; 0 when it is not installed. */
  readonly levels: Readonly<Record<EquipmentKind, number>>;
  readonly heating: boolean;
  readonly fogging: boolean;
  readonly dosing: boolean;
  readonly lit: boolean;
  /** How far the vents are open, 0–1. */
  readonly ventOpening: number;
}

export function sameLook(a: EquipmentLook, b: EquipmentLook): boolean {
  return (
    a.heating === b.heating &&
    a.fogging === b.fogging &&
    a.dosing === b.dosing &&
    a.lit === b.lit &&
    a.ventOpening === b.ventOpening &&
    (Object.keys(a.levels) as EquipmentKind[]).every(
      (kind) => a.levels[kind] === b.levels[kind],
    )
  );
}

function shadow(g: Graphics, { x, y }: Point, width = 22): void {
  g.ellipse(x, y + 4, width, 8).fill({ color: COLORS.shadow, alpha: 0.15 });
}

/** Devices on the floor and the back walls: drawn before the plants. */
export function drawEquipmentBack(
  g: Graphics,
  layout: SceneLayout,
  look: EquipmentLook,
): void {
  g.clear();
  const { levels } = look;
  const spot = (kind: keyof SceneLayout['equipmentSpots']) =>
    tileCenter(layout.equipmentSpots[kind]);

  if (levels.vents >= 2) drawFan(g, layout, look.ventOpening > 0);
  if (levels.heater === 2) drawPipes(g, layout, look.heating);
  if (levels.fertigation > 0)
    drawTanks(g, spot('fertigation'), levels.fertigation);
  if (levels.heater > 0)
    drawHeater(g, spot('heater'), levels.heater, look.heating);
  if (levels.co2 > 0) drawCo2(g, spot('co2'), levels.co2, look.dosing);
  if (levels.fogger > 0) drawFogPump(g, layout, spot('fogger'), levels.fogger);
}

/** Lamps over the plots and fog under the ridge: drawn after the plants. */
export function drawEquipmentFront(
  g: Graphics,
  layout: SceneLayout,
  look: EquipmentLook,
): void {
  g.clear();
  if (look.levels.lights > 0) {
    for (const tile of layout.plots) {
      drawLamp(g, tileCenter(tile), look.levels.lights, look.lit);
    }
  }
  if (look.levels.fogger > 0) drawFogLine(g, layout, look.fogging);
}

function drawHeater(g: Graphics, p: Point, level: number, on: boolean): void {
  const { x, y } = p;
  shadow(g, p);
  if (level === 1) {
    // A gas heater with its flue.
    g.rect(x + 7, y - 52, 6, 20).fill(COLORS.metalDark);
    g.roundRect(x - 18, y - 34, 36, 34, 6)
      .fill(COLORS.heater)
      .stroke(INK);
    for (const dy of [-26, -19]) {
      g.moveTo(x - 11, y + dy)
        .lineTo(x + 11, y + dy)
        .stroke({ color: 0xffffff, width: 2 });
    }
    if (on) flame(g, x, y - 6);
  } else if (level === 2) {
    // The boiler that feeds the hot-water pipes.
    g.rect(x - 3, y - 64, 6, 14).fill(COLORS.metalDark);
    g.roundRect(x - 15, y - 52, 30, 52, 10)
      .fill(COLORS.boiler)
      .stroke(INK);
    toonCircle(g, x, y - 34, 6, 0xffffff, COLORS.metalDark);
    if (on) flame(g, x, y - 8);
  } else {
    // A heat pump: a box with a big fan.
    g.roundRect(x - 21, y - 38, 42, 38, 6)
      .fill(COLORS.heatPump)
      .stroke(INK);
    toonCircle(g, x, y - 19, 13, COLORS.metal, COLORS.metalDark);
    for (const [dx, dy] of [
      [0, -7],
      [6, 4],
      [-6, 4],
    ] as const) {
      g.ellipse(x + dx, y - 19 + dy, 3.5, 5.5).fill(COLORS.metalDark);
    }
    if (on) {
      for (const dx of [-10, 0, 10]) {
        g.moveTo(x + dx, y - 44)
          .quadraticCurveTo(x + dx + 5, y - 50, x + dx, y - 56)
          .stroke({ color: COLORS.flame, width: 2.5, alpha: 0.8 });
      }
    }
  }
}

function flame(g: Graphics, x: number, y: number): void {
  g.circle(x, y - 10, 22).fill({ color: COLORS.flame, alpha: 0.2 });
  g.ellipse(x, y - 4, 6, 9).fill(COLORS.flame);
  g.ellipse(x, y - 2, 3, 5).fill(COLORS.flameCore);
}

/** Hot-water pipes along the back walls, glowing while they heat. */
function drawPipes(g: Graphics, layout: SceneLayout, hot: boolean): void {
  const { i, j, width, length } = layout.greenhouse;
  const color = hot ? COLORS.hotPipe : COLORS.metal;
  for (const height of [4, 10]) {
    const corner = at(i + 0.25, j + 0.25, height);
    const back = at(i + width - 0.25, j + 0.25, height);
    const left = at(i + 0.25, j + length - 0.25, height);
    g.moveTo(back.x, back.y)
      .lineTo(corner.x, corner.y)
      .lineTo(left.x, left.y)
      .stroke({ color, width: 4, cap: 'round', join: 'round' });
  }
}

/** A fan in the back gable. */
function drawFan(g: Graphics, layout: SceneLayout, spinning: boolean): void {
  const { a, b } = greenhouseCorners(layout.greenhouse);
  const { x, y } = lift(lerp(a, b, 0.5), WALL_HEIGHT - 26);
  toonCircle(g, x, y, 17, COLORS.metal, COLORS.metalDark);
  for (const [dx, dy] of [
    [0, -9],
    [8, 5],
    [-8, 5],
  ] as const) {
    g.ellipse(x + dx, y + dy, 5, 7).fill({
      color: COLORS.metalDark,
      alpha: spinning ? 0.4 : 1,
    });
  }
  if (spinning) g.circle(x, y, 12).stroke({ color: 0xffffff, width: 2 });
}

/** Water and feed tanks for fertigation. */
function drawTanks(g: Graphics, p: Point, level: number): void {
  const { x, y } = p;
  shadow(g, p, 26);
  if (level >= 2) {
    g.roundRect(x + 4, y - 34, 18, 34, 7)
      .fill(COLORS.feedTank)
      .stroke(INK);
  }
  g.roundRect(x - 14, y - 46, 26, 46, 9)
    .fill(COLORS.waterTank)
    .stroke(INK);
  g.rect(x - 14, y - 30, 26, 5).fill(COLORS.waterTankDark);
  g.roundRect(x - 6, y - 52, 10, 7, 2).fill(COLORS.metalDark);
}

function drawCo2(g: Graphics, p: Point, level: number, on: boolean): void {
  const { x, y } = p;
  shadow(g, p, 20);
  if (level === 1) {
    // Two gas bottles.
    for (const [dx, h] of [
      [-13, 46],
      [1, 42],
    ] as const) {
      g.roundRect(x + dx, y - h, 12, h, 6)
        .fill(COLORS.metal)
        .stroke(INK);
      g.rect(x + dx, y - h + 12, 12, 6).fill(COLORS.co2Band);
      g.rect(x + dx + 4, y - h - 5, 4, 6).fill(COLORS.metalDark);
    }
  } else {
    g.roundRect(x - 16, y - 58, 32, 58, 12)
      .fill(0xe3f2fd)
      .stroke(INK);
    g.rect(x - 16, y - 40, 32, 8).fill(COLORS.co2Band);
    g.rect(x - 3, y - 64, 6, 7).fill(COLORS.metalDark);
  }
  if (on) {
    g.circle(x + 14, y - 62, 6).fill({ color: COLORS.co2Puff, alpha: 0.7 });
    g.circle(x + 21, y - 73, 8).fill({ color: COLORS.co2Puff, alpha: 0.5 });
  }
}

/** The fog pump, with its pipe up to the ridge. */
function drawFogPump(
  g: Graphics,
  layout: SceneLayout,
  p: Point,
  level: number,
): void {
  const { x, y } = p;
  const { ridgeBack } = greenhouseCorners(layout.greenhouse);
  shadow(g, p, 18);
  g.moveTo(x + 6, y - 20)
    .lineTo(x + 6, ridgeBack.y + 22)
    .lineTo(ridgeBack.x, ridgeBack.y + 22)
    .stroke({ color: COLORS.metalDark, width: level >= 2 ? 4 : 3 });
  if (level >= 2) {
    g.roundRect(x - 18, y - 36, 12, 36, 6)
      .fill(COLORS.metal)
      .stroke(INK);
  }
  g.roundRect(x - 8, y - 22, 26, 22, 5)
    .fill(COLORS.fogPump)
    .stroke(INK);
  toonCircle(g, x + 5, y - 11, 5, 0xffffff, COLORS.metalDark);
}

/** The fog line under the ridge, misting while it runs. */
function drawFogLine(g: Graphics, layout: SceneLayout, on: boolean): void {
  const { ridgeBack, ridgeFront } = greenhouseCorners(layout.greenhouse);
  const from = lift(ridgeBack, -22);
  const to = lift(ridgeFront, -22);
  g.moveTo(from.x, from.y)
    .lineTo(to.x, to.y)
    .stroke({ color: COLORS.metalDark, width: 3 });
  for (let k = 1; k < 6; k++) {
    const p = lerp(from, to, k / 6);
    g.circle(p.x, p.y + 2, 2.5).fill(COLORS.metalDark);
    if (on) {
      g.circle(p.x - 6, p.y + 18, 13).fill({ color: COLORS.mist, alpha: 0.6 });
      g.circle(p.x + 8, p.y + 26, 11).fill({ color: COLORS.mist, alpha: 0.5 });
    }
  }
}

/** A lamp hanging over a plot, and its glow on the plant when lit. */
function drawLamp(g: Graphics, plot: Point, level: number, on: boolean): void {
  const { x, y } = lift(plot, WALL_HEIGHT - 12);
  const glow = level >= 2 ? COLORS.ledGlow : COLORS.lampGlow;
  if (on) {
    g.poly([
      x - 12,
      y + 5,
      x + 12,
      y + 5,
      x + 36,
      plot.y - 8,
      x - 36,
      plot.y - 8,
    ]).fill({ color: glow, alpha: 0.18 });
  }
  g.moveTo(x, y - 18)
    .lineTo(x, y)
    .stroke({ color: COLORS.metalDark, width: 2 });
  if (level >= 2) {
    g.roundRect(x - 24, y - 3, 48, 7, 3)
      .fill(COLORS.led)
      .stroke(INK);
    g.rect(x - 20, y + 3, 40, 2).fill(on ? glow : COLORS.metal);
  } else {
    g.poly([x - 16, y - 4, x + 16, y - 4, x + 10, y + 5, x - 10, y + 5])
      .fill(COLORS.metalDark)
      .stroke(INK);
    g.ellipse(x, y + 6, 6, 3).fill(on ? COLORS.lamp : COLORS.metal);
  }
}
