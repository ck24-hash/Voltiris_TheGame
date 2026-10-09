import type {
  AirVariable,
  Climate,
  EquipmentKind,
  GameContent,
  Setpoints,
} from '@voltiris/content';
import { controlSetpoints } from './control';
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
  /** Nutrients (EC) the plants take up. */
  readonly nutrients: number;
}

export function plantActivity(
  greenhouse: Greenhouse,
  content: GameContent,
): PlantActivity {
  let growth = 0;
  let water = 0;
  let nutrients = 0;
  for (const { planting } of greenhouse.plots) {
    if (planting?.status !== 'growing') continue;
    const crop = content.crops[planting.cropId];
    const rate = growthRate(greenhouse.climate, crop);
    growth += rate;
    water += rate * crop.waterUse;
    nutrients += rate * crop.nutrientUse;
  }
  return { growth, water, nutrients };
}

export interface DeviceRun {
  /** How hard it works this hour: 0 is idle, 1 flat out. */
  readonly load: number;
  /** What it costs this hour in energy and supplies, Volticoins. */
  readonly cost: number;
}

/** What the equipment does in one hour, and where that takes the air. */
export interface ClimatePlan {
  /** The targets in use: the player's, or the climate computer's. */
  readonly setpoints: Setpoints;
  /** The devices that run this hour (all installed ones, unless switched off). */
  readonly devices: Readonly<Partial<Record<EquipmentKind, DeviceRun>>>;
  /** Where the air is heading with the devices running this way. */
  readonly balance: Readonly<Record<AirVariable, number>>;
  /**
   * Water and nutrients at the end of the hour: what the plants leave,
   * topped up by fertigation.
   */
  readonly substrate: { readonly water: number; readonly nutrients: number };
  /** Energy for the whole greenhouse this hour, kWh. */
  readonly gas: number;
  readonly power: number;
  /** Running costs this hour, Volticoins. */
  readonly cost: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Works out one hour of climate control. With `running` false every device
 * stays off (the player cannot pay for it), and the air heads for the
 * balance the weather, the glass and the plants give.
 */
export function planClimate(
  greenhouse: Greenhouse,
  activity: PlantActivity,
  content: GameContent,
  running = true,
): ClimatePlan {
  const { physics, energyPrices: prices } = content;
  const outside = physics.outside;
  const plots = greenhouse.plots.length;
  const glass = glassOf(greenhouse, content);
  const setpoints = controlSetpoints(greenhouse, content);
  const device = <K extends EquipmentKind>(kind: K) =>
    running ? installedDevice(greenhouse, kind, content) : null;
  const heater = device('heater');
  const vents = device('vents');
  const fogger = device('fogger');
  const co2 = device('co2');
  const lights = device('lights');
  const fertigation = device('fertigation');

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
  const heatFor = (cooling: number) =>
    clamp(
      (setpoints.heatTo - outside.temperature) * heatLoss - warmth + cooling,
      0,
      heaterMax,
    );

  // The fogger brings humidity up to humidityMin, allowing for the heat that
  // dries the air; its fog cools, and the heater makes up for that.
  const foggerMax = fogger ? fogger.level.moisture * fogger.strength : 0;
  const unfogged =
    outside.humidity + moisture / air - physics.heatingDries * heatFor(0);
  const fog = clamp((setpoints.humidityMin - unfogged) * air, 0, foggerMax);
  const cooling = fog * physics.fogCooling;
  const heat = heatFor(cooling);

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

  // The plants drink; fertigation tops water and nutrients back up, right
  // to the setpoints if its output allows.
  const { climate } = greenhouse;
  const waterMax = fertigation
    ? fertigation.level.water * fertigation.strength
    : 0;
  const nutrientsMax = fertigation
    ? fertigation.level.nutrients * fertigation.strength
    : 0;
  const topUp = (left: number, target: number, max: number) =>
    left < target ? Math.min(target, left + max) : left;
  const waterLeft = Math.max(0, climate.water - activity.water);
  const nutrientsLeft = Math.max(0, climate.nutrients - activity.nutrients);
  const substrate = {
    water: topUp(waterLeft, setpoints.water, waterMax),
    nutrients: topUp(nutrientsLeft, setpoints.nutrients, nutrientsMax),
  };
  const refill = {
    water: substrate.water - waterLeft,
    nutrients: substrate.nutrients - nutrientsLeft,
  };

  // Energy and supplies, for the whole greenhouse.
  const devices: Partial<Record<EquipmentKind, DeviceRun>> = {};
  let gas = 0;
  let power = 0;
  if (heater) {
    const used = (heat * plots) / heater.level.efficiency;
    const isGas = heater.level.fuel === 'gas';
    if (isGas) gas += used;
    else power += used;
    devices.heater = {
      load: heat / heaterMax,
      cost: used * (isGas ? prices.gas : prices.power),
    };
  }
  if (vents) {
    const load = ventAir / ventsMax;
    const fans = vents.level.power * load * plots;
    power += fans;
    devices.vents = { load, cost: fans * prices.power };
  }
  if (fogger) {
    const load = fog / foggerMax;
    const pump = fogger.level.power * load * plots;
    power += pump;
    devices.fogger = {
      load,
      cost: pump * prices.power + fog * plots * fogger.level.waterCost,
    };
  }
  if (co2) {
    devices.co2 = {
      load: dose / doseMax,
      cost: (dose * plots * co2.level.costPer1000) / 1000,
    };
  }
  if (lights) {
    const used = lamps * lights.level.powerPerPar * plots;
    power += used;
    devices.lights = { load: lamps / lampsMax, cost: used * prices.power };
  }
  if (fertigation) {
    const load = Math.max(
      refill.water / waterMax,
      refill.nutrients / nutrientsMax,
    );
    const pump = fertigation.level.power * load * plots;
    power += pump;
    devices.fertigation = {
      load,
      cost:
        pump * prices.power +
        refill.water * fertigation.level.waterCost +
        refill.nutrients * fertigation.level.nutrientCost,
    };
  }

  return {
    setpoints,
    devices,
    balance: {
      temperature: outside.temperature + (warmth + heat - cooling) / heatLoss,
      humidity: clamp(
        outside.humidity + (moisture + fog) / air - physics.heatingDries * heat,
        0,
        100,
      ),
      co2: Math.max(0, outside.co2 + (dose + exhaust - uptake) / air),
      light: sunlight + lamps,
    },
    substrate,
    gas,
    power,
    cost: Object.values(devices).reduce((sum, run) => sum + run.cost, 0),
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
    water: plan.substrate.water,
    nutrients: plan.substrate.nutrients,
  };
}

/** The plan the next tick runs for a greenhouse, as it stands now. */
export function greenhousePlan(
  greenhouse: Greenhouse,
  content: GameContent,
): ClimatePlan {
  return planClimate(greenhouse, plantActivity(greenhouse, content), content);
}
