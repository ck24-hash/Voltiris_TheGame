import type { Graphics } from 'pixi.js';
import type { Building, Footprint } from '../../iso/layout';
import { COLORS } from '../palette';
import { at, cone, flat, INK, isoBox, lerp, onFrontWall } from './shapes';

// Placeholder toon buildings, drawn in world coordinates on their footprint.
// Each faces the road (+j). Their game modes open in later phases, so traffic
// cones stand in front of them for now.

export function drawBuilding(g: Graphics, building: Building): void {
  const f = building.footprint;
  switch (building.id) {
    case 'market':
      drawMarketStall(g, f);
      break;
    case 'energy':
      drawEnergyShed(g, f);
      break;
    case 'village':
      drawTownHall(g, f);
      break;
  }
  cone(g, at(f.i + 0.2, f.j + f.length - 0.05));
  cone(g, at(f.i + f.width - 0.2, f.j + f.length - 0.05));
}

/** Point on the ground of `f`, by fractions of its width and length. */
function inside(f: Footprint, u: number, w: number, height = 0) {
  return at(f.i + f.width * u, f.j + f.length * w, height);
}

function post(g: Graphics, f: Footprint, u: number, w: number, top: number) {
  const foot = inside(f, u, w);
  g.rect(foot.x - 2.5, foot.y - top, 5, top)
    .fill(COLORS.woodDark)
    .stroke(INK);
}

function drawMarketStall(g: Graphics, f: Footprint): void {
  // Crates at the back, the counter at the front, under a striped awning.
  post(g, f, 0.1, 0.15, 84);
  post(g, f, 0.9, 0.15, 84);
  isoBox(g, { i: f.i + 0.35, j: f.j + 0.3, width: 0.5, length: 0.45 }, 26, {
    left: COLORS.woodLight,
    right: COLORS.wood,
    top: COLORS.woodDark,
  });
  isoBox(g, { i: f.i + 0.2, j: f.j + 1.2, width: 1.6, length: 0.5 }, 30, {
    left: COLORS.woodLight,
    right: COLORS.wood,
    top: COLORS.wood,
  });
  // Produce on the counter.
  for (const [u, color] of [
    [0.25, COLORS.tomato],
    [0.4, COLORS.cucumber],
    [0.55, COLORS.pepper],
    [0.7, COLORS.tomato],
  ] as const) {
    const p = inside(f, u, 0.72, 30);
    g.circle(p.x, p.y - 4, 6)
      .fill(color)
      .stroke(INK);
  }
  post(g, f, 0.1, 0.95, 62);
  post(g, f, 0.9, 0.95, 62);

  // Awning: high at the back, low over the road, in red and white stripes.
  const stripes = 6;
  for (let k = 0; k < stripes; k++) {
    const u0 = 0.02 + (0.96 * k) / stripes;
    const u1 = 0.02 + (0.96 * (k + 1)) / stripes;
    g.poly(
      flat([
        inside(f, u0, 0.1, 86),
        inside(f, u1, 0.1, 86),
        inside(f, u1, 1.02, 62),
        inside(f, u0, 1.02, 62),
      ]),
    ).fill(k % 2 === 0 ? COLORS.awningRed : COLORS.awningWhite);
    // Scalloped edge along the front.
    const edge = lerp(inside(f, u0, 1.02, 62), inside(f, u1, 1.02, 62), 0.5);
    g.circle(edge.x, edge.y, 9).fill(
      k % 2 === 0 ? COLORS.awningRed : COLORS.awningWhite,
    );
  }
  g.poly(
    flat([
      inside(f, 0.02, 0.1, 86),
      inside(f, 0.98, 0.1, 86),
      inside(f, 0.98, 1.02, 62),
      inside(f, 0.02, 1.02, 62),
    ]),
  ).stroke(INK);
}

function drawEnergyShed(g: Graphics, f: Footprint): void {
  const shed = { i: f.i + 0.2, j: f.j + 0.3, width: 1.6, length: 1.3 };
  isoBox(g, shed, 56, {
    left: COLORS.shedWall,
    right: COLORS.shedWallDark,
    top: COLORS.shedRoof,
  });

  // Solar panel on the roof, tilted towards the sun.
  const backLeft = inside(f, 0.2, 0.25, 84);
  const backRight = inside(f, 0.8, 0.25, 84);
  const frontRight = inside(f, 0.8, 0.75, 60);
  const frontLeft = inside(f, 0.2, 0.75, 60);
  for (const leg of [backLeft, backRight]) {
    g.moveTo(leg.x, leg.y)
      .lineTo(leg.x, leg.y + 24)
      .stroke({ color: COLORS.metalDark, width: 3 });
  }
  g.poly(flat([backLeft, backRight, frontRight, frontLeft]))
    .fill(COLORS.solarPanel)
    .stroke(INK);
  const cells: [typeof backLeft, typeof backLeft][] = [
    [lerp(backLeft, backRight, 1 / 3), lerp(frontLeft, frontRight, 1 / 3)],
    [lerp(backLeft, backRight, 2 / 3), lerp(frontLeft, frontRight, 2 / 3)],
    [lerp(backLeft, frontLeft, 0.5), lerp(backRight, frontRight, 0.5)],
  ];
  for (const [a, b] of cells) g.moveTo(a.x, a.y).lineTo(b.x, b.y);
  g.stroke({ color: COLORS.solarLine, width: 1.5 });

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

  // A battery cabinet beside the door.
  isoBox(g, { i: f.i + 1.35, j: f.j + 1.68, width: 0.45, length: 0.25 }, 26, {
    left: COLORS.battery,
    right: COLORS.batteryDark,
    top: COLORS.battery,
  });
}

function drawTownHall(g: Graphics, f: Footprint): void {
  const hall = { i: f.i + 0.15, j: f.j + 0.3, width: 1.7, length: 1.4 };
  const wallTop = 62;
  const ridge = 100;
  isoBox(g, hall, wallTop, {
    left: COLORS.hallWall,
    right: COLORS.hallWallDark,
    top: COLORS.hallWallDark,
  });

  // Gable roof, ridge along i; the gable end shows on the +i side.
  const eave = 0.12;
  const midJ = hall.j + hall.length / 2;
  const ridgeLeft = at(hall.i - eave, midJ, ridge);
  const ridgeRight = at(hall.i + hall.width + eave, midJ, ridge);
  g.poly(
    flat([
      at(hall.i + hall.width, hall.j, wallTop),
      at(hall.i + hall.width, hall.j + hall.length, wallTop),
      at(hall.i + hall.width, midJ, ridge),
    ]),
  )
    .fill(COLORS.hallWallDark)
    .stroke(INK);
  g.poly(
    flat([
      at(hall.i - eave, hall.j - eave, wallTop - 4),
      at(hall.i + hall.width + eave, hall.j - eave, wallTop - 4),
      ridgeRight,
      ridgeLeft,
    ]),
  )
    .fill(COLORS.hallRoofDark)
    .stroke(INK);
  g.poly(
    flat([
      ridgeLeft,
      ridgeRight,
      at(hall.i + hall.width + eave, hall.j + hall.length + eave, wallTop - 4),
      at(hall.i - eave, hall.j + hall.length + eave, wallTop - 4),
    ]),
  )
    .fill(COLORS.hallRoof)
    .stroke(INK);

  // Little clock tower with a flag on the ridge.
  const tower = { i: f.i + 0.82, j: midJ - 0.18, width: 0.36, length: 0.36 };
  isoBox(
    g,
    tower,
    26,
    {
      left: COLORS.hallWall,
      right: COLORS.hallWallDark,
      top: COLORS.hallRoof,
    },
    ridge - 8,
  );
  const clock = onFrontWall(tower, 0.5, ridge + 5);
  g.circle(clock.x, clock.y, 6).fill(0xffffff).stroke(INK);
  const pole = at(
    tower.i + tower.width / 2,
    tower.j + tower.length / 2,
    ridge + 18,
  );
  g.moveTo(pole.x, pole.y)
    .lineTo(pole.x, pole.y - 32)
    .stroke({ color: COLORS.ink, width: 2.5 });
  g.poly([pole.x, pole.y - 32, pole.x + 20, pole.y - 26, pole.x, pole.y - 20])
    .fill(COLORS.flag)
    .stroke(INK);

  // Door and windows on the front wall.
  const quad = (u0: number, u1: number, v0: number, v1: number, fill: number) =>
    g
      .poly(
        flat([
          onFrontWall(hall, u0, v0),
          onFrontWall(hall, u1, v0),
          onFrontWall(hall, u1, v1),
          onFrontWall(hall, u0, v1),
        ]),
      )
      .fill(fill)
      .stroke(INK);
  quad(0.42, 0.58, 0, 34, COLORS.door);
  quad(0.12, 0.3, 26, 46, COLORS.windowGlass);
  quad(0.7, 0.88, 26, 46, COLORS.windowGlass);
}
