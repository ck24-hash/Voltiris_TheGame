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

/**
 * Advances the game by exactly one tick (one in-game hour). Each greenhouse's
 * equipment runs only while the player's money covers everything owed:
 * whole Volticoins are paid every hour, and the fractions carry over.
 */
export function tick(state: GameState, content: GameContent): GameState {
  const gameHour = state.clock.gameHour + 1;
  const rng = createRng(state.rng);
  const market = tickMarket(state.market, rng, content.market);
  let { money, owed } = state;
  const greenhouses = state.greenhouses.map((greenhouse) => {
    const activity = plantActivity(greenhouse, content);
    let plan = planClimate(greenhouse, activity, content);
    const due = owed + plan.cost;
    if (due > money) {
      // Not enough money: the equipment stays off this hour.
      plan = planClimate(greenhouse, activity, content, false);
    } else {
      const pay = Math.floor(due);
      money -= pay;
      owed = due - pay;
    }
    return tickGreenhouse(greenhouse, plan, gameHour, content);
  });
  return {
    ...state,
    clock: { ...state.clock, gameHour },
    rng: rng.snapshot(),
    money,
    owed,
    greenhouses,
    storage: removeSpoiled(state.storage, gameHour, content),
    market,
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
