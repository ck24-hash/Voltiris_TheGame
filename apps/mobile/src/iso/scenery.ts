import { boxAround, footprintBox, sortForDrawing, type Box } from './drawOrder';
import type { Building, Footprint, SceneLayout } from './layout';
import type { GridPoint } from './projection';

// Decoration around the lot, placed by noise so the land looks the same on
// every launch. Grid positions may be fractional.

export type StandingKind = 'tree' | 'pine' | 'bush' | 'rock' | 'mailbox';
export type FlatKind = 'tuft' | 'flowers';

export interface Scenery<K extends string> {
  readonly kind: K;
  readonly i: number;
  readonly j: number;
  /** 0–1: varies size and colour. */
  readonly variant: number;
}

/** One tile-long piece of the lot's fence, for draw ordering. */
export interface FenceSegment {
  readonly from: GridPoint;
  readonly to: GridPoint;
}

/** How far the wild land around the lot is decorated, in tiles. */
const SCENERY_RADIUS = 18;

/** Deterministic noise in [0, 1) for a tile and a salt. */
export function noise(i: number, j: number, salt: number): number {
  let h =
    Math.imul(i | 0, 0x27d4eb2d) ^
    Math.imul(j | 0, 0x165667b1) ^
    Math.imul(salt | 0, 0x2f6b8e73);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}

/** The neighbour's crop field across the road. */
export function neighbourField(layout: SceneLayout): Footprint {
  return { i: layout.lot.i + 1, j: layout.road.j1 + 1, width: 10, length: 5 };
}

function inside(f: Footprint, i: number, j: number, margin: number): boolean {
  return (
    i > f.i - margin &&
    i < f.i + f.width + margin &&
    j > f.j - margin &&
    j < f.j + f.length + margin
  );
}

/** Wild decoration around the lot: standing objects and flat ground details. */
export function scatterScenery(layout: SceneLayout): {
  readonly standing: Scenery<StandingKind>[];
  readonly flat: Scenery<FlatKind>[];
} {
  const { lot, road, forSale } = layout;
  const field = neighbourField(layout);
  const blocked = (i: number, j: number) =>
    inside(lot, i, j, 0.8) ||
    (j > road.j0 - 0.8 && j < road.j1 + 0.8) ||
    inside(field, i, j, 0.5) ||
    forSale.some(
      (s) => Math.abs(s.i + 0.5 - i) < 1.6 && Math.abs(s.j + 0.5 - j) < 1.6,
    );

  const standing: Scenery<StandingKind>[] = [];
  const flat: Scenery<FlatKind>[] = [];
  for (
    let ti = lot.i - SCENERY_RADIUS;
    ti < lot.i + lot.width + SCENERY_RADIUS;
    ti++
  ) {
    for (
      let tj = lot.j - SCENERY_RADIUS;
      tj < lot.j + lot.length + SCENERY_RADIUS;
      tj++
    ) {
      const i = ti + 0.2 + 0.6 * noise(ti, tj, 2);
      const j = tj + 0.2 + 0.6 * noise(ti, tj, 3);
      if (blocked(i, j)) continue;
      const roll = noise(ti, tj, 1);
      const variant = noise(ti, tj, 4);
      if (roll < 0.045) standing.push({ kind: 'tree', i, j, variant });
      else if (roll < 0.07) standing.push({ kind: 'pine', i, j, variant });
      else if (roll < 0.12) standing.push({ kind: 'bush', i, j, variant });
      else if (roll < 0.135) standing.push({ kind: 'rock', i, j, variant });
      else if (roll < 0.3) flat.push({ kind: 'tuft', i, j, variant });
      else if (roll < 0.36) flat.push({ kind: 'flowers', i, j, variant });
    }
  }
  return { standing: [...lotScenery(layout), ...standing], flat };
}

/** Hand-placed trees and bushes on the player's lot. */
export function lotScenery(layout: SceneLayout): Scenery<StandingKind>[] {
  const { lot, path } = layout;
  const back = { i: lot.i, j: lot.j };
  const frontJ = lot.j + lot.length;
  const at = (kind: StandingKind, i: number, j: number, variant = 0.5) => ({
    kind,
    i,
    j,
    variant,
  });
  return [
    at('tree', back.i + 0.8, back.j + 0.9, 0.8),
    at('tree', back.i + 4, back.j + 0.8, 0.3),
    at('tree', back.i + 9.4, back.j + 0.9, 0.6),
    at('pine', back.i + 0.6, back.j + 5, 0.6),
    at('bush', back.i + 4.1, back.j + 5),
    at('bush', lot.i + 0.7, frontJ - 0.8, 0.2),
    at('bush', lot.i + lot.width - 0.7, frontJ - 0.8, 0.9),
    at('bush', path.i - 0.6, frontJ - 0.5, 0.4),
    at('bush', path.i + path.width + 0.6, frontJ - 0.5, 0.7),
    at('mailbox', path.i + path.width + 1.4, frontJ - 0.4),
  ];
}

/** The lot's fence, one tile at a time, with a gate where the path meets it. */
export function fenceSegments(layout: SceneLayout): FenceSegment[] {
  const { lot, path } = layout;
  const segments: FenceSegment[] = [];
  const i1 = lot.i + lot.width;
  const j1 = lot.j + lot.length;
  for (let i = lot.i; i < i1; i++) {
    segments.push({ from: { i, j: lot.j }, to: { i: i + 1, j: lot.j } });
    const inGate = i + 1 > path.i && i < path.i + path.width;
    if (!inGate) segments.push({ from: { i, j: j1 }, to: { i: i + 1, j: j1 } });
  }
  for (let j = lot.j; j < j1; j++) {
    segments.push({ from: { i: lot.i, j }, to: { i: lot.i, j: j + 1 } });
    segments.push({ from: { i: i1, j }, to: { i: i1, j: j + 1 } });
  }
  return segments;
}

export type SceneItem =
  | { readonly kind: 'scenery'; readonly scenery: Scenery<StandingKind> }
  | { readonly kind: 'fence'; readonly segment: FenceSegment }
  | { readonly kind: 'building'; readonly building: Building }
  | { readonly kind: 'greenhouse' }
  | { readonly kind: 'sign'; readonly tile: GridPoint };

const STANDING_SIZE: Record<StandingKind, number> = {
  tree: 0.5,
  pine: 0.5,
  bush: 0.45,
  rock: 0.35,
  mailbox: 0.2,
};

function itemBox(item: SceneItem, layout: SceneLayout): Box {
  switch (item.kind) {
    case 'scenery': {
      const { i, j, kind } = item.scenery;
      return boxAround(i, j, STANDING_SIZE[kind]);
    }
    case 'fence': {
      const { from, to } = item.segment;
      return {
        i0: Math.min(from.i, to.i) - 0.02,
        i1: Math.max(from.i, to.i) + 0.02,
        j0: Math.min(from.j, to.j) - 0.02,
        j1: Math.max(from.j, to.j) + 0.02,
      };
    }
    case 'building':
      return footprintBox(item.building.footprint);
    case 'greenhouse':
      return footprintBox(layout.greenhouse);
    case 'sign':
      return boxAround(item.tile.i + 0.5, item.tile.j + 0.5, 0.4);
  }
}

/** Everything standing in the world, back to front. */
export function sceneItems(
  layout: SceneLayout,
  standing: readonly Scenery<StandingKind>[],
): SceneItem[] {
  const items: SceneItem[] = [
    { kind: 'greenhouse' },
    ...layout.buildings.map((building) => ({
      kind: 'building' as const,
      building,
    })),
    ...layout.forSale.map((tile) => ({ kind: 'sign' as const, tile })),
    ...fenceSegments(layout).map((segment) => ({
      kind: 'fence' as const,
      segment,
    })),
    ...standing.map((scenery) => ({ kind: 'scenery' as const, scenery })),
  ];
  return sortForDrawing(items, (item) => itemBox(item, layout));
}
