import type { Graphics } from 'pixi.js';
import type { Building, Footprint } from '../../iso/layout';
import { COLORS } from '../palette';
import { at, cone, flat, INK, isoBox, lerp, onFrontWall } from './shapes';

// Placeholder toon buildings, drawn in world coordinates on their footprint.
// Each faces the road (+j). Traffic cones stand in front of the ones whose
// game modes open in later phases. The energy shed changes with what is
// built, so `drawEnergySite` draws it.

export function drawBuilding(
  g: Graphics,
  building: Building,
  underConstruction: boolean,
): void {
  const f = building.footprint;
  switch (building.id) {
    case 'market':
      drawMarketStall(g, f);
      break;
    case 'storage':
      drawStorageBarn(g, f);
      break;
    case 'energy':
      break;
    case 'village':
      drawTownHall(g, f);
      break;
  }
  if (underConstruction) {
    cone(g, at(f.i + 0.2, f.j + f.length - 0.05));
    cone(g, at(f.i + f.width - 0.2, f.j + f.length - 0.05));
  }
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

/** A red barn with its gable end and big doors facing the road, crates beside. */
function drawStorageBarn(g: Graphics, f: Footprint): void {
  const barn = { i: f.i + 0.2, j: f.j + 0.2, width: 1.6, length: 1.45 };
  const wallTop = 56;
  const ridge = 98;
  isoBox(g, barn, wallTop, {
    left: COLORS.barnWall,
    right: COLORS.barnWallDark,
    top: COLORS.barnWallDark,
  });

  // Gable end on the front wall, then the roof: ridge along j, eaves on
  // the sides and the back.
  const front = barn.j + barn.length;
  const middle = barn.i + barn.width / 2;
  g.poly(
    flat([
      at(barn.i, front, wallTop),
      at(barn.i + barn.width, front, wallTop),
      at(middle, front, ridge),
    ]),
  )
    .fill(COLORS.barnWall)
    .stroke(INK);
  const eave = 0.12;
  const low = wallTop - 6;
  const [i0, i1, j0] = [
    barn.i - eave,
    barn.i + barn.width + eave,
    barn.j - eave,
  ];
  g.poly(
    flat([
      at(i0, j0, low),
      at(i0, front, low),
      at(middle, front, ridge),
      at(middle, j0, ridge),
    ]),
  )
    .fill(COLORS.barnRoof)
    .stroke(INK);
  g.poly(
    flat([
      at(middle, j0, ridge),
      at(middle, front, ridge),
      at(i1, front, low),
      at(i1, j0, low),
    ]),
  )
    .fill(COLORS.barnRoofDark)
    .stroke(INK);

  // Big double doors with white cross braces, and a hayloft window.
  const quad = (u0: number, u1: number, v0: number, v1: number) =>
    flat([
      onFrontWall(barn, u0, v0),
      onFrontWall(barn, u1, v0),
      onFrontWall(barn, u1, v1),
      onFrontWall(barn, u0, v1),
    ]);
  g.poly(quad(0.24, 0.76, 0, 42))
    .fill(COLORS.barnDoor)
    .stroke({ ...INK, color: COLORS.barnTrim, width: 3 });
  for (const [u0, u1] of [
    [0.24, 0.5],
    [0.5, 0.76],
  ] as const) {
    const bottomLeft = onFrontWall(barn, u0, 0);
    const topRight = onFrontWall(barn, u1, 42);
    const bottomRight = onFrontWall(barn, u1, 0);
    const topLeft = onFrontWall(barn, u0, 42);
    g.moveTo(bottomLeft.x, bottomLeft.y).lineTo(topRight.x, topRight.y);
    g.moveTo(bottomRight.x, bottomRight.y).lineTo(topLeft.x, topLeft.y);
  }
  g.stroke({ color: COLORS.barnTrim, width: 2.5 });
  g.poly(quad(0.42, 0.58, 62, 78))
    .fill(COLORS.barnDoor)
    .stroke({ ...INK, color: COLORS.barnTrim, width: 2.5 });

  // Crates of produce waiting on either side of the doors.
  const crate = (i: number, j: number, base = 0) =>
    isoBox(
      g,
      { i, j, width: 0.3, length: 0.28 },
      18,
      { left: COLORS.woodLight, right: COLORS.wood, top: COLORS.woodDark },
      base,
    );
  crate(f.i + 0.04, f.j + 1.7);
  crate(f.i + 1.64, f.j + 1.7);
  crate(f.i + 1.64, f.j + 1.7, 18);
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
