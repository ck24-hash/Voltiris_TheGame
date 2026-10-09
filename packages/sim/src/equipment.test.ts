// Phase 6 "Done when": each piece of equipment visibly changes the climate
// and the growth of the crops. Plus running costs, wear and servicing.

import {
  defaultContent,
  type ClimateVariable,
  type CropId,
  type EquipmentKind,
  type Setpoints,
} from '@voltiris/content';
import { describe, expect, it } from 'vitest';
import { greenhousePlan } from './climate';
import { hourPrices } from './energy';
import { installedDevice, serviceCost } from './equipment';
import type { GameState, Greenhouse } from './state';
import {
  accept,
  equipped,
  firstGreenhouse,
  growCrop,
  newTestGame,
  plant,
  runTicks,
  withGreenhouse,
} from './test-utils';
import { planHour } from './tick';

/** A greenhouse's plan for the first hour of the game. */
function planOf(greenhouse: Greenhouse, content = defaultContent) {
  return greenhousePlan(greenhouse, content, hourPrices(0, content));
}

/** A change this big shows on the climate badges. */
const VISIBLE: Record<ClimateVariable, number> = {
  temperature: 1,
  humidity: 3,
  co2: 100,
  light: 50,
  water: 5,
};

interface Case {
  readonly kind: EquipmentKind;
  readonly crop: CropId;
  readonly variable: ClimateVariable;
  readonly direction: 1 | -1;
  readonly setpoints?: Partial<Setpoints>;
  readonly start?: GameState;
  /** Whether the player waters by hand. */
  readonly byHand?: boolean;
}

const CASES: readonly (readonly [string, Case])[] = [
  [
    'a heater warms cucumbers',
    { kind: 'heater', crop: 'cucumber', variable: 'temperature', direction: 1 },
  ],
  [
    'vents cool strawberries under diffuse glass',
    {
      kind: 'vents',
      crop: 'strawberry',
      variable: 'temperature',
      direction: -1,
      setpoints: { ventAbove: 22 },
      start: withGreenhouse(newTestGame(), () => ({ glass: 3 })),
    },
  ],
  [
    'fog makes the air humid for cucumbers',
    { kind: 'fogger', crop: 'cucumber', variable: 'humidity', direction: 1 },
  ],
  [
    'CO₂ feeds tomatoes',
    { kind: 'co2', crop: 'tomato', variable: 'co2', direction: 1 },
  ],
  [
    'grow lights brighten tomatoes',
    {
      kind: 'lights',
      crop: 'tomato',
      variable: 'light',
      direction: 1,
      setpoints: { light: 550 },
    },
  ],
  [
    'irrigation keeps tomatoes watered when nobody else does',
    {
      kind: 'irrigation',
      crop: 'tomato',
      variable: 'water',
      direction: 1,
      byHand: false,
    },
  ],
];

describe('each piece of equipment changes the climate and the growth', () => {
  it.each(CASES)('%s', (_, c) => {
    const start = c.start ?? newTestGame();
    const options = { byHand: c.byHand ?? true };
    const without = growCrop(start, c.crop, options);
    const fitted = growCrop(
      equipped([c.kind], c.setpoints, start),
      c.crop,
      options,
    );

    const before = firstGreenhouse(without.state).climate[c.variable];
    const after = firstGreenhouse(fitted.state).climate[c.variable];
    expect(c.direction * (after - before)).toBeGreaterThanOrEqual(
      VISIBLE[c.variable],
    );
    // Ready sooner, and better.
    expect(fitted.ticks).toBeLessThan(without.ticks);
    expect(fitted.quality).toBeGreaterThan(without.quality);
  });

  it('double glass keeps the sun’s heat in: warmer, a little darker, and cucumbers grow faster', () => {
    const single = growCrop(newTestGame(), 'cucumber');
    const double = growCrop(
      withGreenhouse(newTestGame(), () => ({ glass: 2 })),
      'cucumber',
    );
    const climate = (s: GameState) => firstGreenhouse(s).climate;
    expect(climate(double.state).temperature).toBeGreaterThan(
      climate(single.state).temperature + 2,
    );
    expect(climate(double.state).light).toBeLessThan(
      climate(single.state).light,
    );
    expect(double.ticks).toBeLessThan(single.ticks);
    expect(double.quality).toBeGreaterThan(single.quality);
  });

  it('the climate computer runs the equipment for the crop, near its best', () => {
    const all: EquipmentKind[] = [
      'heater',
      'vents',
      'fogger',
      'co2',
      'lights',
      'irrigation',
    ];
    const bare = growCrop(newTestGame(), 'cucumber');
    const fitted = equipped(all);
    const computer = accept(fitted, {
      type: 'UpgradeGreenhouse',
      id: 'cmd-computer',
      issuedAt: 0,
      greenhouseId: firstGreenhouse(fitted).id,
      upgrade: 'computer',
    });
    const auto = growCrop(computer, 'cucumber', { byHand: false });
    const { growthHours } = defaultContent.crops.cucumber;
    expect(auto.ticks).toBeLessThan(bare.ticks);
    expect(auto.ticks).toBeLessThanOrEqual(growthHours + 3);
    expect(auto.quality).toBeGreaterThan(0.9);
    expect(bare.quality).toBeLessThan(0.7);
  });
});

describe('running costs', () => {
  it('are paid every hour in whole Volticoins, the rest carried over', () => {
    const start = plant(equipped(['heater', 'co2']), 'pepper');
    let state = start;
    let costs = 0;
    for (let i = 0; i < 50; i++) {
      costs += planHour(state, defaultContent).cost;
      state = runTicks(state, 1);
      expect(Number.isInteger(state.money)).toBe(true);
      expect(state.owed).toBeGreaterThanOrEqual(0);
      expect(state.owed).toBeLessThan(1);
    }
    expect(costs).toBeGreaterThan(1);
    expect(start.money - state.money + state.owed).toBeCloseTo(costs, 9);
  });

  it('stop the equipment when the player cannot pay', () => {
    const broke = { ...plant(equipped(['heater']), 'pepper'), money: 0 };
    const after = runTicks(broke, 20);
    expect(after.money).toBe(0);
    // No heat: the greenhouse stays as the sun leaves it.
    expect(firstGreenhouse(after).climate.temperature).toBeCloseTo(
      defaultContent.greenhouse.startingClimate.temperature,
      9,
    );
  });

  it('keep a reserve for seeds: the equipment stops before the money runs below it', () => {
    const { reserve } = defaultContent.economy;
    const heated = plant(equipped(['heater'], { heatTo: 30 }), 'pepper');
    const start = { ...heated, money: reserve + 3 };
    expect(planHour(start, defaultContent).running).toBe(true);
    const after = runTicks(start, 50);
    expect(after.money).toBeGreaterThanOrEqual(reserve);
    expect(after.money).toBeLessThan(start.money);
    expect(planHour(after, defaultContent).running).toBe(false);
    // Enough left for seeds.
    expect(plant(after, 'microgreens', 1).money).toBeGreaterThanOrEqual(0);
  });

  it('grow with the greenhouse, while the climate stays the same', () => {
    const small = plant(equipped(['heater']), 'pepper');
    const large = withGreenhouse(small, (g) => ({
      size: 3,
      plots: [...g.plots, ...g.plots.map((p) => ({ ...p, id: `${p.id}-2` }))],
    }));
    const smallPlan = planOf(firstGreenhouse(small), defaultContent);
    const largePlan = planOf(firstGreenhouse(large), defaultContent);
    expect(largePlan.balance).toEqual(smallPlan.balance);
    expect(largePlan.cost).toBeCloseTo(2 * smallPlan.cost, 12);
  });
});

describe('wear', () => {
  /** A heater working flat out (it cannot reach 30 °C) for `hours`. */
  function hardWork(hours: number) {
    const state = plant(equipped(['heater'], { heatTo: 30 }), 'pepper');
    return runTicks(state, hours);
  }

  it('builds up with use and lowers the output', () => {
    const { wearRate } = defaultContent.equipment.levels.heater[0] ?? {
      wearRate: 0,
    };
    const used = hardWork(100);
    expect(firstGreenhouse(used).equipment.heater?.wear).toBeCloseTo(
      100 * wearRate,
      9,
    );
    const worn = hardWork(1000);
    expect(firstGreenhouse(worn).equipment.heater?.wear).toBe(1);
    expect(
      installedDevice(firstGreenhouse(worn), 'heater', defaultContent)
        ?.strength,
    ).toBe(1 - defaultContent.equipment.wearLoss);
    expect(firstGreenhouse(worn).climate.temperature).toBeLessThan(
      firstGreenhouse(used).climate.temperature - 1,
    );
  });

  it('does not build up while a device idles', () => {
    // The heater keeps 10 °C: the sun alone does better.
    const idle = runTicks(
      plant(equipped(['heater'], { heatTo: 10 }), 'pepper'),
      100,
    );
    expect(firstGreenhouse(idle).equipment.heater?.wear).toBe(0);
  });

  it('is cleared by a service, for a share of the price', () => {
    const worn = hardWork(200);
    const greenhouse = firstGreenhouse(worn);
    const heater = greenhouse.equipment.heater;
    if (!heater) throw new Error('expected a heater');
    const serviced = accept(worn, {
      type: 'ServiceEquipment',
      id: 'cmd-service',
      issuedAt: 0,
      greenhouseId: greenhouse.id,
      kind: 'heater',
    });
    expect(firstGreenhouse(serviced).equipment.heater).toEqual({
      level: 1,
      wear: 0,
    });
    expect(serviced.money).toBe(
      worn.money - serviceCost('heater', heater, defaultContent),
    );
  });
});

describe('resting', () => {
  it('lets the equipment rest while nothing grows, saving its running costs', () => {
    const empty = equipped(['heater', 'co2', 'lights']);
    const plan = planOf(firstGreenhouse(empty));
    expect(plan.resting).toBe(true);
    expect(plan.cost).toBe(0);
    expect(planHour(empty, defaultContent).cost).toBe(0);

    // A crop goes in: the equipment gets to work.
    const planted = planOf(firstGreenhouse(plant(empty, 'tomato')));
    expect(planted.resting).toBe(false);
    expect(planted.cost).toBeGreaterThan(0);
  });

  it('rests again once the crops are ready', () => {
    const { state } = growCrop(equipped(['heater', 'lights']), 'microgreens');
    expect(planOf(firstGreenhouse(state)).resting).toBe(true);
    const after = runTicks(state, 24);
    expect(after.money).toBe(state.money);
    expect(firstGreenhouse(after).equipment).toEqual(
      firstGreenhouse(state).equipment,
    );
  });
});
