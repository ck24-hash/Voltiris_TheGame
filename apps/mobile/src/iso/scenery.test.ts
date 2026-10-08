import { describe, expect, it } from 'vitest';
import { createLayout, type Footprint } from './layout';
import {
  fenceSegments,
  lotScenery,
  neighbourField,
  noise,
  sceneItems,
  scatterScenery,
} from './scenery';

const layout = createLayout(4);

function within(f: Footprint, i: number, j: number): boolean {
  return i >= f.i && i <= f.i + f.width && j >= f.j && j <= f.j + f.length;
}

describe('scenery', () => {
  it('looks the same every time', () => {
    expect(scatterScenery(layout)).toEqual(scatterScenery(layout));
    expect(noise(3, -7, 1)).toBe(noise(3, -7, 1));
    expect(noise(3, -7, 1)).not.toBe(noise(3, -7, 2));
  });

  it('keeps wild growth off the lot, the road and the neighbour field', () => {
    const { standing, flat } = scatterScenery(layout);
    const wild = [...standing.slice(lotScenery(layout).length), ...flat];
    expect(wild.length).toBeGreaterThan(100);
    const field = neighbourField(layout);
    for (const { i, j } of wild) {
      expect(within(layout.lot, i, j)).toBe(false);
      expect(j > layout.road.j0 && j < layout.road.j1).toBe(false);
      expect(within(field, i, j)).toBe(false);
    }
  });

  it('keeps the trees and bushes on the lot clear of buildings and the path', () => {
    const { standing } = scatterScenery(layout);
    const onLot = standing.filter(({ i, j }) => within(layout.lot, i, j));
    expect(onLot.length).toBeGreaterThan(0);
    const blocked = [
      layout.greenhouse,
      layout.path,
      ...layout.buildings.map((b) => b.footprint),
    ];
    for (const { i, j } of onLot) {
      for (const f of blocked) expect(within(f, i, j)).toBe(false);
    }
  });
});

describe('fence', () => {
  it('goes all the way round the lot except for a gate at the path', () => {
    const { lot, path } = layout;
    const segments = fenceSegments(layout);
    const front = lot.j + lot.length;
    const frontSegments = segments.filter(
      (s) => s.from.j === front && s.to.j === front,
    );
    const pathMiddle = path.i + path.width / 2;
    // The path is off the tile grid, so the gate takes out two segments.
    expect(frontSegments).toHaveLength(lot.width - 2);
    expect(
      frontSegments.some((s) => s.from.i <= pathMiddle && s.to.i >= pathMiddle),
    ).toBe(false);
    expect(segments).toHaveLength(2 * (lot.width + lot.length) - 2);
  });
});

describe('sceneItems', () => {
  const items = sceneItems(layout, scatterScenery(layout).standing, 4);
  const indexOf = (match: (item: (typeof items)[number]) => boolean) =>
    items.findIndex(match);

  it('includes everything exactly once', () => {
    const expected =
      1 +
      layout.buildings.length +
      layout.forSale.length +
      fenceSegments(layout).length +
      scatterScenery(layout).standing.length +
      4;
    expect(items).toHaveLength(expected);
  });

  it('draws the back fence before the greenhouse and the front fence after it', () => {
    // The fence pieces straight behind and in front of the greenhouse.
    const { i } = layout.greenhouse;
    const greenhouse = indexOf((it) => it.kind === 'greenhouse');
    const fenceAt = (j: number) =>
      indexOf(
        (it) =>
          it.kind === 'fence' &&
          it.segment.from.i === i &&
          it.segment.from.j === j &&
          it.segment.to.j === j,
      );
    const backFence = fenceAt(layout.lot.j);
    const frontFence = fenceAt(layout.lot.j + layout.lot.length);
    expect(backFence).not.toBe(-1);
    expect(frontFence).not.toBe(-1);
    expect(backFence).toBeLessThan(greenhouse);
    expect(frontFence).toBeGreaterThan(greenhouse);
  });

  it('draws the energy shed after the greenhouse it stands beside', () => {
    const greenhouse = indexOf((it) => it.kind === 'greenhouse');
    const shed = indexOf(
      (it) => it.kind === 'building' && it.building.id === 'energy',
    );
    expect(shed).toBeGreaterThan(greenhouse);
  });
});
