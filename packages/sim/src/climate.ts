import type {
  AirVariable,
  Climate,
  EquipmentKind,
  GameContent,
  Setpoints,
} from '@voltiris/content';
import { controlSetpoints } from './control';
import type { Co2Demand, HeatDemand, HourPrices } from './energy';
import { glassOf, installedDevice } from './equipment';
import { growthRate } from './growth';
import type { Greenhouse } from './state';

// Each hour the air moves part of the way to a balance set by the weather
// outside, the glass, the plants and the equipment. Every device works to its
// setpoint as far as its output allows. Past the growth rates, the climate
// uses only + − × ÷, min and max, so every device computes the same climate.

/** What the plants do in one hour, from how fast they grow in this climate. */
export interface PlantActivity {
  /** Hours of growth this hour, summed over the plots. */
  readonly growth: number;
  /** Water (moisture % points) the plants take up. */
  readonly water: number;
}

export function plantActivity(
  greenhouse: Greenhouse,
  content: GameContent,
): PlantActivity {
  let growth = 0;
  let water = 0;
  for (const { planting } of greenhouse.plots) {
    if (planting?.status !== 'growing') continue;
    const crop = content.crops[planting.cropId];
    const rate = growthRate(greenhouse.climate, crop);
    growth += rate;
    water += rate * crop.waterUse;
  }
  return { growth, water };
}

export interface DeviceRun {
  /** How hard it works this hour: 0 is idle, 1 flat out. */
  readonly load: number;
  /** Power and gas it uses this hour, kWh (so kW). */
  readonly power: number;
  readonly gas: number;
  /**
   * What it costs this hour in energy and supplies at this hour's prices,
   * Volticoins: before solar, the battery and the CHP cut the bill.
   */
  readonly cost: number;
}

/** What the equipment does in one hour, and where that takes the air. */
export interface ClimatePlan {
  /** The targets in use: the player's, or the climate computer's. */
  readonly setpoints: Setpoints;
  /**
   * The devices that run this hour: every installed one, unless nothing is
   * growing (they rest) or the money does not cover the hour.
   */
  readonly devices: Readonly<Partial<Record<EquipmentKind, DeviceRun>>>;
  /** Nothing is growing, so the equipment rests and costs nothing. */
  readonly resting: boolean;
  /** Where the air is heading with the devices running this way. */
  readonly balance: Readonly<Record<AirVariable, number>>;
  /** Water at the end of the hour: what the plants leave, topped up by irrigation. */
  readonly water: number;
  /** Energy for the whole greenhouse this hour, kWh: heater gas, and power. */
  readonly gas: number;
  readonly power: number;
  /** What the heater gives and the injector doses, for the energy system. */
  readonly heat: HeatDemand | null;
  readonly co2: Co2Demand | null;
  /** Water for the fogger and irrigation this hour, Volticoins. */
  readonly waterCost: number;
  /** Running costs this hour at this hour's prices (see `DeviceRun.cost`). */
  readonly cost: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Works out one hour of climate control. The equipment rests while nothing
 * grows; with `running` false it stays off too (the player cannot pay for
 * it). Then the air heads for the balance the weather, the glass and the
 * plants give.
 */
export function planClimate(
  greenhouse: Greenhouse,
  activity: PlantActivity,
  content: GameContent,
  prices: HourPrices,
  running = true,
): ClimatePlan {
  const { physics } = content;
  const outside = physics.outside;
  const plots = greenhouse.plots.length;
  const glass = glassOf(greenhouse, content);
  const setpoints = controlSetpoints(greenhouse, content);
  const resting = !greenhouse.plots.some(
    ({ planting }) => planting?.status === 'growing',
  );
  const device = <K extends EquipmentKind>(kind: K) =>
    running && !resting ? installedDevice(greenhouse, kind, content) : null;
  const heater = device('heater');
  const vents = device('vents');
  const fogger = device('fogger');
  const co2 = device('co2');
  const lights = device('lights');
  const irrigation = device('irrigation');

  // Light: the sun through the glass, topped up by the lamps. Both warm.
  const sunlight = outside.sunlight * glass.transmission;
  const lampsMax = lights ? lights.level.par * lights.strength : 0;
  const lamps = clamp(setpoints.light - sunlight, 0, lampsMax);
  const warmth =
    sunlight * physics.sunHeat + lamps * (lights?.level.heatPerPar ?? 0);

  // The plants breathe out moisture and take up CO₂, per plot on average.
  const perPlot = plots > 0 ? activity.growth / plots : 0;
  const moisture = physics.transpiration * perPlot;
  const uptake = physics.co2Uptake * perPlot;

  // Vents open far enough to bring the heat and the humidity down to their
  // limits; where outside is no cooler or drier, they open all the way.
  const ventsMax = vents ? vents.level.airChanges * vents.strength : 0;
  const coolingAir =
    setpoints.ventAbove > outside.temperature
      ? (warmth / (setpoints.ventAbove - outside.temperature) -
          glass.heatLoss) /
        physics.ventHeatLoss
      : ventsMax;
  const dryingAir =
    setpoints.humidityMax > outside.humidity
      ? moisture / (setpoints.humidityMax - outside.humidity) - glass.airChanges
      : ventsMax;
  const ventAir = clamp(Math.max(coolingAir, dryingAir), 0, ventsMax);
  const air = glass.airChanges + ventAir;
  const heatLoss = glass.heatLoss + ventAir * physics.ventHeatLoss;

  // The heater makes up what the air needs to reach heatTo.
  const heaterMax = heater ? heater.level.heat * heater.strength : 0;
  const heat = clamp(
    (setpoints.heatTo - outside.temperature) * heatLoss - warmth,
    0,
    heaterMax,
  );

  // The fogger brings humidity up to humidityMin, allowing for the heat that
  // dries the air.
  const foggerMax = fogger ? fogger.level.moisture * fogger.strength : 0;
  const unfogged =
    outside.humidity + moisture / air - physics.heatingDries * heat;
  const fog = clamp((setpoints.humidityMin - unfogged) * air, 0, foggerMax);

  // A gas heater's exhaust adds CO₂; the injector tops it up to the target.
  const exhaust =
    heater?.level.fuel === 'gas'
      ? (heat / heater.level.efficiency) * heater.level.exhaustCo2
      : 0;
  const doseMax = co2 ? co2.level.dose * co2.strength : 0;
  const dose = clamp(
    (setpoints.co2 - outside.co2) * air + uptake - exhaust,
    0,
    doseMax,
  );

  // The plants drink; irrigation tops the water back up, right to the
  // setpoint if its output allows.
  const waterMax = irrigation
    ? irrigation.level.water * irrigation.strength
    : 0;
  const waterLeft = Math.max(0, greenhouse.climate.water - activity.water);
  const water =
    waterLeft < setpoints.water
      ? Math.min(setpoints.water, waterLeft + waterMax)
      : waterLeft;
  const refill = water - waterLeft;

  // Energy and water, for the whole greenhouse.
  const devices: Partial<Record<EquipmentKind, DeviceRun>> = {};
  let heatDemand: HeatDemand | null = null;
  let co2Demand: Co2Demand | null = null;
  const run = (
    kind: EquipmentKind,
    load: number,
    use: { power?: number; gas?: number; supplies?: number },
  ) => {
    const { power = 0, gas = 0, supplies = 0 } = use;
    devices[kind] = {
      load,
      power,
      gas,
      cost: power * prices.buy + gas * prices.gas + supplies,
    };
  };
  if (heater) {
    const { fuel, efficiency } = heater.level;
    const kwh = heat * plots;
    const used = kwh / efficiency;
    heatDemand = { kwh, fuel, efficiency };
    run(
      'heater',
      heat / heaterMax,
      fuel === 'gas' ? { gas: used } : { power: used },
    );
  }
  if (vents) {
    const load = ventAir / ventsMax;
    run('vents', load, { power: vents.level.power * load * plots });
  }
  let waterCost = 0;
  if (fogger) {
    const load = fog / foggerMax;
    const fogWater = fog * plots * fogger.level.waterCost;
    waterCost += fogWater;
    run('fogger', load, {
      power: fogger.level.power * load * plots,
      supplies: fogWater,
    });
  }
  if (co2) {
    co2Demand = { units: dose * plots, costPer1000: co2.level.costPer1000 };
    run('co2', dose / doseMax, {
      supplies: (co2Demand.units * co2Demand.costPer1000) / 1000,
    });
  }
  if (lights) {
    run('lights', lamps / lampsMax, {
      power: lamps * lights.level.powerPerPar * plots,
    });
  }
  if (irrigation) {
    const load = refill / waterMax;
    const irrigationWater = refill * irrigation.level.waterCost;
    waterCost += irrigationWater;
    run('irrigation', load, {
      power: irrigation.level.power * load * plots,
      supplies: irrigationWater,
    });
  }
  const runs = Object.values(devices);

  return {
    setpoints,
    devices,
    resting,
    balance: {
      temperature: outside.temperature + (warmth + heat) / heatLoss,
      humidity: clamp(
        outside.humidity + (moisture + fog) / air - physics.heatingDries * heat,
        0,
        100,
      ),
      co2: Math.max(0, outside.co2 + (dose + exhaust - uptake) / air),
      light: sunlight + lamps,
    },
    water,
    gas: runs.reduce((sum, r) => sum + r.gas, 0),
    power: runs.reduce((sum, r) => sum + r.power, 0),
    heat: heatDemand,
    co2: co2Demand,
    waterCost,
    cost: runs.reduce((sum, r) => sum + r.cost, 0),
  };
}

/** Air this close to its balance settles on it, so it reaches its setpoint. */
const SETTLED = 0.01;

/** The climate after one hour of a plan. */
export function nextClimate(
  climate: Climate,
  plan: ClimatePlan,
  content: GameContent,
): Climate {
  const { settle } = content.physics;
  const toward = (variable: AirVariable) => {
    const share = settle[variable];
    const balance = plan.balance[variable];
    const next = climate[variable] + share * (balance - climate[variable]);
    return share > 0 && Math.abs(balance - next) < SETTLED ? balance : next;
  };
  return {
    temperature: toward('temperature'),
    humidity: toward('humidity'),
    co2: toward('co2'),
    light: toward('light'),
    water: plan.water,
  };
}

/** A greenhouse's plan for an hour with these prices, as it stands now. */
export function greenhousePlan(
  greenhouse: Greenhouse,
  content: GameContent,
  prices: HourPrices,
): ClimatePlan {
  return planClimate(
    greenhouse,
    plantActivity(greenhouse, content),
    content,
    prices,
  );
}
