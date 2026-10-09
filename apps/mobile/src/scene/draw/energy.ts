import type { Graphics } from 'pixi.js';
import type { Footprint } from '../../iso/layout';
import type { Point } from '../../iso/projection';
import { COLORS } from '../palette';
import { at, flat, INK, isoBox, lerp, onFrontWall } from './shapes';

// Placeholder toon shapes for the energy site: the shed (roof panels and
// battery cabinets), and the yard beside it (solar field and CHP unit).

/** What the scene shows of the energy system. */
export interface EnergyLook {
  /** Level of each asset; 0 when there is none. */
  readonly solar: number;
  readonly battery: number;
  readonly chp: number;
  /** The CHP runs this hour. */
  readonly chpOn: boolean;
}

export function drawEnergySite(
  g: Graphics,
  shed: Footprint,
  yard: Footprint,
  look: EnergyLook,
): void {
  g.clear();
  drawShed(g, shed, look);
  drawYard(g, yard, look);
}

/** Point on the ground of `f`, by fractions of its width and length. */
function inside(f: Footprint, u: number, w: number, height = 0): Point {
  return at(f.i + f.width * u, f.j + f.length * w, height);
}

/** A tilted solar panel: its back edge high, its front edge low. */
function panel(
  g: Graphics,
  back: [Point, Point],
  front: [Point, Point],
  legs: number,
): void {
  for (const leg of back) {
    g.moveTo(leg.x, leg.y)
      .lineTo(leg.x, leg.y + legs)
      .stroke({ color: COLORS.metalDark, width: 3 });
  }
  const [backLeft, backRight] = back;
  const [frontLeft, frontRight] = front;
  g.poly(flat([backLeft, backRight, frontRight, frontLeft]))
    .fill(COLORS.solarPanel)
    .stroke(INK);
  for (const k of [1 / 3, 2 / 3]) {
    const a = lerp(backLeft, backRight, k);
    const b = lerp(frontLeft, frontRight, k);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y);
  }
  const left = lerp(backLeft, frontLeft, 0.5);
  const right = lerp(backRight, frontRight, 0.5);
  g.moveTo(left.x, left.y).lineTo(right.x, right.y);
  g.stroke({ color: COLORS.solarLine, width: 1.5 });
}

function drawShed(g: Graphics, f: Footprint, look: EnergyLook): void {
  const shed = { i: f.i + 0.2, j: f.j + 0.3, width: 1.6, length: 1.3 };
  isoBox(g, shed, 56, {
    left: COLORS.shedWall,
    right: COLORS.shedWallDark,
    top: COLORS.shedRoof,
  });

  // Rooftop panels, tilted towards the sun.
  if (look.solar >= 1) {
    panel(
      g,
      [inside(f, 0.2, 0.25, 84), inside(f, 0.8, 0.25, 84)],
      [inside(f, 0.2, 0.75, 60), inside(f, 0.8, 0.75, 60)],
      24,
    );
  }

  // Lightning sign on the front wall, and a door.
  const sign = onFrontWall(shed, 0.32, 34);
  g.circle(sign.x, sign.y, 12).fill(COLORS.bolt).stroke(INK);
  g.poly([
    sign.x + 1.5,
    sign.y - 8,
    sign.x - 5,
    sign.y + 1,
    sign.x - 0.5,
    sign.y + 1,
    sign.x - 2,
    sign.y + 8,
    sign.x + 5,
    sign.y - 1,
    sign.x + 0.5,
    sign.y - 1,
  ]).fill(COLORS.ink);
  g.poly(
    flat([
      onFrontWall(shed, 0.6, 0),
      onFrontWall(shed, 0.82, 0),
      onFrontWall(shed, 0.82, 38),
      onFrontWall(shed, 0.6, 38),
    ]),
  )
    .fill(COLORS.shedRoof)
    .stroke(INK);

  // A battery cabinet in front of the shed for each battery level.
  for (const u of [1.4, 0.05, 0.5].slice(0, look.battery)) {
    isoBox(g, { i: f.i + u, j: f.j + 1.68, width: 0.42, length: 0.25 }, 26, {
      left: COLORS.battery,
      right: COLORS.batteryDark,
      top: COLORS.battery,
    });
  }
}

function drawYard(g: Graphics, f: Footprint, look: EnergyLook): void {
  // Rows of panels: the back half for a solar field, more for a large one.
  const rows: [number, number, number][] = [];
  if (look.solar >= 2) rows.push([0.05, 0.95, 0.05], [0.05, 0.95, 0.3]);
  if (look.solar >= 3) rows.push([0.52, 0.95, 0.55], [0.52, 0.95, 0.8]);
  for (const [u0, u1, w] of rows) {
    panel(
      g,
      [inside(f, u0, w, 26), inside(f, u1, w, 26)],
      [inside(f, u0, w + 0.18, 10), inside(f, u1, w + 0.18, 10)],
      16,
    );
  }

  if (look.chp >= 1) drawChp(g, f, look.chp, look.chpOn);
}

/** The CHP unit: an engine in a box, with a chimney that smokes when it runs. */
function drawChp(g: Graphics, f: Footprint, level: number, on: boolean): void {
  const box = { i: f.i + 0.08, j: f.j + 1.12, width: 0.8, length: 0.75 };
  // The biogas unit is the bigger engine.
  const height = level >= 2 ? 40 : 32;
  isoBox(g, box, height, {
    left: COLORS.chp,
    right: COLORS.chpDark,
    top: COLORS.chp,
  });
  const vent = onFrontWall(box, 0.5, height / 2);
  g.rect(vent.x - 9, vent.y - 5, 18, 10)
    .fill(COLORS.chpDark)
    .stroke(INK);
  const chimney = at(
    box.i + box.width * 0.75,
    box.j + box.length * 0.3,
    height,
  );
  g.rect(chimney.x - 4, chimney.y - 26, 8, 26)
    .fill(COLORS.metalDark)
    .stroke(INK);
  if (on) {
    for (const [dx, dy, r] of [
      [2, -34, 7],
      [8, -46, 9],
      [4, -60, 11],
    ] as const) {
      g.circle(chimney.x + dx, chimney.y + dy, r).fill({
        color: COLORS.smoke,
        alpha: 0.75,
      });
    }
  }
}
