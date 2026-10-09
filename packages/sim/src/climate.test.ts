import {
  AIR_VARIABLES,
  defaultContent,
  type GameContent,
} from '@voltiris/content';
import { describe, expect, it } from 'vitest';
import {
  greenhousePlan,
  nextClimate,
  planClimate,
  plantActivity,
  type PlantActivity,
} from './climate';
import { hourPrices } from './energy';
import type { GameState, Greenhouse } from './state';
import {
  equipped,
  firstGreenhouse,
  newTestGame,
  plant,
  withClimate,
  withGreenhouse,
} from './test-utils';

const content = defaultContent;
const { physics } = content;
const NOTHING: PlantActivity = { growth: 0, water: 0 };

/** A tomato growing, so the equipment works (it rests while nothing grows). */
function growing(state: GameState): GameState {
  return plant(state, 'tomato');
}

function greenhouseOf(...args: Parameters<typeof equipped>): Greenhouse {
  return firstGreenhouse(growing(equipped(...args)));
}

// The climate does not depend on the hour's prices; midnight's will do.
function planWith(
  greenhouse: Greenhouse,
  activity: PlantActivity,
  using: GameContent,
  running = true,
) {
  return planClimate(
    greenhouse,
    activity,
    using,
    hourPrices(0, using),
    running,
  );
}

/** The equipment's plan, leaving out the plants' breath. */
function planOf(greenhouse: Greenhouse, using: GameContent = content) {
  return planWith(greenhouse, NOTHING, using);
}

describe('an empty greenhouse', () => {
  it('starts at the balance the weather and the first glass give', () => {
    const greenhouse = firstGreenhouse(newTestGame());
    const plan = planWith(greenhouse, NOTHING, content);
    for (const variable of AIR_VARIABLES) {
      expect(plan.balance[variable], variable).toBeCloseTo(
        content.greenhouse.startingClimate[variable],
        9,
      );
    }
    expect(plan.cost).toBe(0);
  });

  it('is warmer and darker behind better-insulating glass', () => {
    const plan = (glass: number) =>
      planWith(
        firstGreenhouse(withGreenhouse(newTestGame(), () => ({ glass }))),
        NOTHING,
        content,
      ).balance;
    expect(plan(2).temperature).toBeGreaterThan(plan(1).temperature + 3);
    expect(plan(2).light).toBeLessThan(plan(1).light);
    // Diffuse glass lets more light in, and keeps the heat like double glass.
    expect(plan(3).light).toBeGreaterThan(plan(1).light);
    expect(plan(3).temperature).toBeGreaterThan(plan(2).temperature);
  });
});

describe('growing plants', () => {
  it('breathe out moisture and take up CO₂', () => {
    const planted = firstGreenhouse(
      [0, 1, 2, 3].reduce((s, k) => plant(s, 'tomato', k), newTestGame()),
    );
    const activity = plantActivity(planted, content);
    expect(activity.growth).toBeGreaterThan(0);
    const empty = planWith(planted, NOTHING, content).balance;
    const busy = planWith(planted, activity, content).balance;
    expect(busy.humidity).toBeGreaterThan(empty.humidity + 2);
    expect(busy.co2).toBeLessThan(empty.co2 - 10);
    expect(busy.temperature).toBe(empty.temperature);
  });

  it('drink in proportion to their growth', () => {
    const planted = firstGreenhouse(plant(newTestGame(), 'cucumber'));
    const activity = plantActivity(planted, content);
    const { waterUse } = content.crops.cucumber;
    expect(activity.water).toBeCloseTo(activity.growth * waterUse, 12);
  });
});

describe('nextClimate', () => {
  it('moves the air part of the way to its balance each hour', () => {
    const greenhouse = greenhouseOf(['heater']);
    const plan = planWith(greenhouse, NOTHING, content);
    const next = nextClimate(greenhouse.climate, plan, content);
    const { temperature } = greenhouse.climate;
    expect(next.temperature).toBeCloseTo(
      temperature +
        physics.settle.temperature * (plan.balance.temperature - temperature),
      12,
    );
    expect(next.temperature).toBeGreaterThan(temperature);
    expect(next.temperature).toBeLessThan(plan.balance.temperature);
  });

  it('settles right on the balance once it is close, so it reaches the setpoint', () => {
    const greenhouse = greenhouseOf(['heater']);
    const plan = planWith(greenhouse, NOTHING, content);
    let climate = greenhouse.climate;
    for (let hour = 0; hour < 12; hour++) {
      climate = nextClimate(climate, plan, content);
    }
    expect(climate.temperature).toBe(plan.balance.temperature);
    expect(climate.temperature).toBe(content.control.initial.heatTo);
  });

  it('takes the water from the plan', () => {
    const greenhouse = greenhouseOf(['irrigation']);
    const drinking = { growth: 4, water: 3 };
    const plan = planWith(greenhouse, drinking, content);
    const next = nextClimate(greenhouse.climate, plan, content);
    expect(next.water).toBe(plan.water);
  });
});

describe('equipment', () => {
  it('works to its setpoint', () => {
    const plan = (g: Greenhouse) => planOf(g, content).balance;
    expect(
      plan(greenhouseOf(['heater'], { heatTo: 23 })).temperature,
    ).toBeCloseTo(23, 9);
    expect(
      plan(greenhouseOf(['fogger'], { humidityMin: 70 })).humidity,
    ).toBeCloseTo(70, 9);
    expect(plan(greenhouseOf(['co2'], { co2: 800 })).co2).toBeCloseTo(800, 9);
    expect(plan(greenhouseOf(['lights'], { light: 500 })).light).toBeCloseTo(
      500,
      9,
    );
    const hot = withGreenhouse(
      growing(equipped(['vents'], { ventAbove: 21 })),
      () => ({ glass: 2 }),
    );
    expect(plan(firstGreenhouse(hot)).temperature).toBeCloseTo(21, 9);
  });

  it('works only as far as its output allows', () => {
    const heater = content.equipment.levels.heater[0];
    const glass = content.greenhouse.glass[0];
    if (!heater || !glass) throw new Error('expected content');
    const plan = planOf(greenhouseOf(['heater'], { heatTo: 30 }), content);
    expect(plan.devices.heater?.load).toBe(1);
    expect(plan.balance.temperature).toBeCloseTo(
      content.greenhouse.startingClimate.temperature +
        heater.heat / glass.heatLoss,
      9,
    );
  });

  it('idles when the air is already where the setpoint wants it', () => {
    const plan = planOf(
      greenhouseOf(['heater', 'fogger', 'co2', 'lights'], {
        heatTo: 15,
        humidityMin: 40,
        co2: 400,
        light: 100,
      }),
      content,
    );
    for (const run of Object.values(plan.devices)) {
      expect(run).toEqual({ load: 0, power: 0, gas: 0, cost: 0 });
    }
    expect(plan.gas + plan.power).toBe(0);
  });

  it('stays off when it cannot run, leaving the greenhouse to the weather', () => {
    const greenhouse = greenhouseOf(['heater', 'co2', 'lights']);
    const off = planWith(greenhouse, NOTHING, content, false);
    const empty = planWith(firstGreenhouse(newTestGame()), NOTHING, content);
    expect(off.devices).toEqual({});
    expect(off.cost).toBe(0);
    expect(off.balance).toEqual(empty.balance);
  });

  it('the gas heater burns gas and its exhaust adds CO₂; the heat pump runs on a quarter as much power', () => {
    const [burner, , heatPump] = content.equipment.levels.heater;
    if (!burner || !heatPump) throw new Error('expected heater levels');
    const gas = planOf(greenhouseOf(['heater']), content);
    const pump = planOf(greenhouseOf(['heater', 'heater', 'heater']), content);

    expect(gas.gas).toBeGreaterThan(0);
    expect(gas.power).toBe(0);
    expect(gas.balance.co2).toBeGreaterThan(physics.outside.co2 + 5);
    expect(pump.gas).toBe(0);
    expect(pump.balance.co2).toBeCloseTo(physics.outside.co2, 9);
    // Both give the same heat to reach the setpoint.
    expect(pump.balance.temperature).toBeCloseTo(gas.balance.temperature, 9);
    const heat = gas.gas * burner.efficiency;
    expect(pump.power).toBeCloseTo(heat / heatPump.efficiency, 9);
    expect(heatPump.efficiency).toBe(4);
  });

  it('venting lets CO₂ out, so holding it costs more', () => {
    const open = planOf(
      firstGreenhouse(
        withGreenhouse(
          growing(equipped(['co2', 'vents'], { ventAbove: 22, co2: 600 })),
          () => ({ glass: 3 }),
        ),
      ),
      content,
    );
    const shut = planOf(
      firstGreenhouse(
        withGreenhouse(growing(equipped(['co2'], { co2: 600 })), () => ({
          glass: 3,
        })),
      ),
      content,
    );
    expect(open.devices.vents?.load).toBeGreaterThan(0);
    expect(open.devices.co2?.cost).toBeGreaterThan(shut.devices.co2?.cost ?? 0);
  });

  it('vents open all the way when outside is warmer than the setpoint', () => {
    const heatwave: GameContent = {
      ...content,
      physics: {
        ...physics,
        outside: { ...physics.outside, temperature: 32 },
      },
    };
    const plan = planOf(greenhouseOf(['vents']), heatwave);
    expect(plan.devices.vents?.load).toBe(1);
    expect(plan.balance.temperature).toBeGreaterThan(32);
  });

  it('fog raises the humidity and leaves the temperature alone', () => {
    const plan = planOf(greenhouseOf(['fogger']), content);
    expect(plan.devices.fogger?.load).toBeGreaterThan(0);
    expect(plan.balance.humidity).toBeGreaterThan(
      content.greenhouse.startingClimate.humidity + 10,
    );
    expect(plan.balance.temperature).toBeCloseTo(
      content.greenhouse.startingClimate.temperature,
      9,
    );
  });

  it('irrigation tops the water back up, right to the setpoint', () => {
    const { water } = content.control.initial;
    const dry = withClimate(growing(equipped(['irrigation'])), {
      water: water - 2,
    });
    const plan = planOf(firstGreenhouse(dry), content);
    expect(plan.water).toBe(water);
    expect(plan.devices.irrigation?.cost).toBeGreaterThan(0);
    expect(plan.waterCost).toBeGreaterThan(0);

    // Far below: as much as it can give in an hour.
    const parched = withClimate(dry, { water: 20 });
    const level = content.equipment.levels.irrigation[0];
    expect(planOf(firstGreenhouse(parched), content).water).toBe(
      20 + (level?.water ?? 0),
    );
  });

  it('leaves the water to the plants without irrigation', () => {
    const greenhouse = firstGreenhouse(growing(newTestGame()));
    const drinking = { growth: 4, water: 3 };
    expect(planWith(greenhouse, drinking, content).water).toBe(
      greenhouse.climate.water - 3,
    );
  });

  it('adds up energy and supplies into the running costs', () => {
    const plan = planOf(
      greenhouseOf(['heater', 'co2', 'lights', 'fogger']),
      content,
    );
    const sum = Object.values(plan.devices).reduce((s, r) => s + r.cost, 0);
    expect(plan.cost).toBe(sum);
    expect(plan.cost).toBeGreaterThan(0);
  });
});

describe('resting', () => {
  it('rests while nothing grows: no device runs, and the air follows the weather', () => {
    const empty = firstGreenhouse(
      equipped(['heater', 'fogger', 'co2', 'lights', 'irrigation']),
    );
    const plan = planWith(empty, NOTHING, content);
    expect(plan.resting).toBe(true);
    expect(plan.devices).toEqual({});
    expect(plan.cost).toBe(0);
    expect(plan.balance).toEqual(
      planWith(firstGreenhouse(newTestGame()), NOTHING, content).balance,
    );
  });

  it('works while a crop grows, even one that has stopped growing', () => {
    const planted = greenhouseOf(['heater']);
    expect(planOf(planted).resting).toBe(false);
    // Too cold to grow, but still growing: the heater works to save it.
    const frozen = withClimate(growing(equipped(['heater'])), {
      temperature: -5,
    });
    const plan = greenhousePlan(
      firstGreenhouse(frozen),
      content,
      hourPrices(0, content),
    );
    expect(plantActivity(firstGreenhouse(frozen), content).growth).toBe(0);
    expect(plan.resting).toBe(false);
    expect(plan.devices.heater?.load).toBeGreaterThan(0);
  });
});
