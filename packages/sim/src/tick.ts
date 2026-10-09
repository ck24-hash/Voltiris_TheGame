import {
  EQUIPMENT_KINDS,
  type EquipmentKind,
  type GameContent,
} from '@voltiris/content';
import {
  nextClimate,
  planClimate,
  plantActivity,
  type ClimatePlan,
} from './climate';
import type { Clock } from './clock';
import {
  afterHour,
  hourPrices,
  runEnergy,
  type EnergyDemand,
  type EnergyHour,
} from './energy';
import { equipmentLevel } from './equipment';
import { growPlanting } from './growth';
import { tickMarket } from './market';
import { createRng } from './rng';
import type {
  Equipment,
  GameState,
  Greenhouse,
  InstalledEquipment,
  Plot,
} from './state';
import { removeSpoiled } from './storage';
import { ticksDue } from './time';

/** What the coming hour does: every greenhouse's plan, and the power supply. */
export interface HourPlan {
  /** False when the money does not cover the hour: all equipment stays off. */
  readonly running: boolean;
  /** One plan per greenhouse, in the same order. */
  readonly plans: readonly ClimatePlan[];
  readonly energy: EnergyHour;
  /** The hour's bill: energy and supplies. Negative when selling earns more. */
  readonly cost: number;
}

/**
 * Plans the hour that starts now. The equipment runs only while the money
 * covers everything owed; otherwise it all stays off, and the solar panels
 * and the battery still run (they cost nothing, and spare power sells).
 */
export function planHour(state: GameState, content: GameContent): HourPlan {
  const { gameHour } = state.clock;
  const prices = hourPrices(gameHour, content);
  // The plants grow the same whether the equipment runs or not.
  const growing = state.greenhouses.map((greenhouse) => ({
    greenhouse,
    activity: plantActivity(greenhouse, content),
  }));
  const plan = (running: boolean): HourPlan => {
    const plans = growing.map(({ greenhouse, activity }) =>
      planClimate(greenhouse, activity, content, prices, running),
    );
    const energy = runEnergy(
      state.energy,
      energyDemand(plans),
      gameHour,
      content,
      { gridCharging: running },
    );
    const supplies = plans.reduce((sum, p) => sum + p.supplies, 0);
    return { running, plans, energy, cost: energy.total + supplies };
  };
  const running = plan(true);
  return state.owed + running.cost <= state.money ? running : plan(false);
}

/** What the greenhouses' plans need from the energy system. */
function energyDemand(plans: readonly ClimatePlan[]): EnergyDemand {
  return {
    power: plans.reduce((sum, p) => sum + p.power, 0),
    heat: plans.flatMap((p) => (p.heat ? [p.heat] : [])),
    co2: plans.flatMap((p) => (p.co2 ? [p.co2] : [])),
  };
}

/**
 * Advances the game by exactly one tick (one in-game hour). The hour's bill
 * is paid in whole Volticoins, and the fraction carries over in `owed`;
 * selling spare power can make it a payment to the player.
 */
export function tick(state: GameState, content: GameContent): GameState {
  const gameHour = state.clock.gameHour + 1;
  const rng = createRng(state.rng);
  const market = tickMarket(state.market, rng, content.market);
  const hour = planHour(state, content);
  const due = state.owed + hour.cost;
  const pay = Math.floor(due);
  return {
    ...state,
    clock: { ...state.clock, gameHour },
    rng: rng.snapshot(),
    money: state.money - pay,
    owed: due - pay,
    greenhouses: state.greenhouses.map((greenhouse, k) => {
      const plan = hour.plans[k];
      if (!plan) throw new Error(`No plan for greenhouse ${k}`);
      return tickGreenhouse(greenhouse, plan, gameHour, content);
    }),
    storage: removeSpoiled(state.storage, gameHour, content),
    market,
    energy: afterHour(state.energy, hour.energy, state.clock.gameHour),
  };
}

/**
 * Runs every tick that has come due by `clock.now()`. Leftover time below one
 * tick carries over, so ticks never drift. At most `maxCatchUpMs` of real time
 * is simulated; time beyond that is skipped. If the clock went backwards (the
 * device time was changed), time restarts from now instead of freezing until
 * the clock catches up.
 */
export function advance(
  state: GameState,
  clock: Clock,
  content: GameContent,
): GameState {
  const { realMsPerTick } = content.time;
  const now = clock.now();
  if (now < state.clock.lastTickAt) {
    return { ...state, clock: { ...state.clock, lastTickAt: now } };
  }
  const due = ticksDue(state.clock.lastTickAt, now, realMsPerTick);
  if (due === 0) return state;

  const run = Math.min(due, maxCatchUpTicks(content));
  let next = state;
  for (let i = 0; i < run; i++) next = tick(next, content);

  // Skipped ticks still use up their time, so the game resumes from now.
  return {
    ...next,
    clock: {
      ...next.clock,
      lastTickAt: state.clock.lastTickAt + due * realMsPerTick,
    },
  };
}

/** Most ticks one call to `advance` runs. */
export function maxCatchUpTicks(content: GameContent): number {
  return Math.floor(content.time.maxCatchUpMs / content.time.realMsPerTick);
}

/**
 * One hour in a greenhouse: crops grow in the climate at the start of the
 * hour, then the air moves toward the plan's balance, the plants drink
 * (a crop that has stopped growing drinks nothing) and the equipment that ran
 * wears a little.
 */
function tickGreenhouse(
  greenhouse: Greenhouse,
  plan: ClimatePlan,
  gameHour: number,
  content: GameContent,
): Greenhouse {
  const plots = greenhouse.plots.map((plot): Plot => {
    const { planting } = plot;
    if (planting?.status !== 'growing') return plot;
    return {
      ...plot,
      planting: growPlanting(
        planting,
        greenhouse.climate,
        content.crops[planting.cropId],
        gameHour,
        content.growth,
      ),
    };
  });
  return {
    ...greenhouse,
    climate: nextClimate(greenhouse.climate, plan, content),
    plots,
    equipment: wearDown(greenhouse.equipment, plan, content),
  };
}

/** Devices wear in proportion to how hard they worked. */
function wearDown(
  equipment: InstalledEquipment,
  plan: ClimatePlan,
  content: GameContent,
): InstalledEquipment {
  const next: Partial<Record<EquipmentKind, Equipment>> = { ...equipment };
  for (const kind of EQUIPMENT_KINDS) {
    const device = equipment[kind];
    const load = plan.devices[kind]?.load ?? 0;
    if (!device || load === 0) continue;
    const { wearRate } = equipmentLevel(kind, device.level, content);
    next[kind] = {
      ...device,
      wear: Math.min(1, device.wear + wearRate * load),
    };
  }
  return next;
}
