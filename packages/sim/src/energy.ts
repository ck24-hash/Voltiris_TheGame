import type {
  BatteryLevel,
  ChpLevel,
  GameContent,
  TariffBand,
} from '@voltiris/content';
import type { BookEntry } from './books';
import { levelAt } from './equipment';
import type { Energy } from './state';
import { HOURS_PER_DAY, seasonalValue } from './time';

// The power supply, one hour at a time: own generation (solar, CHP) first,
// then the battery, then the grid. Uses only + − × ÷, min and max, so every
// device computes the same bill.

export interface HourPrices {
  /** The tariff band, e.g. "Peak". */
  readonly band: string;
  /** The cheapest band of the day: the battery fills up from the grid. */
  readonly offPeak: boolean;
  /** Volticoins per kWh bought from, and sold to, the grid. */
  readonly buy: number;
  readonly sell: number;
  /** Volticoins per kWh of fuel. */
  readonly gas: number;
  readonly biogas: number;
}

/** The tariff band an hour of the day (0–23) falls in. */
export function tariffBand(
  hourOfDay: number,
  content: GameContent,
): TariffBand {
  const { tariff } = content.energy.grid;
  let band = tariff[0];
  for (const next of tariff) if (next.from <= hourOfDay) band = next;
  if (!band) throw new RangeError('The tariff has no bands');
  return band;
}

/** Prices for the hour that starts at `gameHour`. */
export function hourPrices(gameHour: number, content: GameContent): HourPrices {
  const { grid, prices } = content.energy;
  const band = tariffBand(gameHour % HOURS_PER_DAY, content);
  const cheapest = Math.min(...grid.tariff.map((b) => b.price));
  const buy = band.price * seasonalValue(grid.seasonal, gameHour, content.time);
  return {
    band: band.name,
    offPeak: band.price === cheapest,
    buy,
    sell: buy * grid.sellShare,
    gas: prices.gas,
    biogas: prices.biogas,
  };
}

/**
 * Share of the solar panels' peak output in the hour that starts at
 * `gameHour`: 0 at night, rising to 1 at midday and falling again.
 */
export function sunshine(gameHour: number, content: GameContent): number {
  const { rise, set } = content.energy.sun;
  const t = (gameHour % HOURS_PER_DAY) + 0.5;
  if (t <= rise || t >= set) return 0;
  const half = (set - rise) / 2;
  const x = (t - rise - half) / half;
  return 1 - x * x;
}

/** Heat a greenhouse heater gives in an hour, kWh, and what it runs on. */
export interface HeatDemand {
  readonly kwh: number;
  readonly fuel: 'gas' | 'power';
  /** Heat out per kWh of fuel or power in. */
  readonly efficiency: number;
}

/** CO₂ an injector doses in an hour (whole greenhouse), and its price. */
export interface Co2Demand {
  readonly units: number;
  readonly costPer1000: number;
}

/** What the greenhouses need from the energy system in one hour. */
export interface EnergyDemand {
  /** kWh of power, heat pumps included. */
  readonly power: number;
  readonly heat: readonly HeatDemand[];
  readonly co2: readonly Co2Demand[];
}

export const NO_DEMAND: EnergyDemand = { power: 0, heat: [], co2: [] };

/** Volticoins the energy cost in an hour. */
export interface EnergyCosts {
  /** Power bought from the grid. */
  readonly power: number;
  /** Spare power sold to the grid: money in, so it lowers the total. */
  readonly powerSold: number;
  /** Gas the greenhouse heaters burned. */
  readonly heating: number;
  /** CO₂ bought for the injectors. */
  readonly co2: number;
  readonly chpFuel: number;
}

/** One hour of the power supply. Energy is in kWh (so kW over the hour). */
export interface EnergyHour {
  readonly prices: HourPrices;
  /** Power the greenhouses used, after CHP heat spared their heat pumps. */
  readonly demand: number;
  readonly solar: number;
  /** Power the CHP made; 0 when it stayed off. */
  readonly chp: number;
  /** CHP heat and CO₂ the greenhouses used. */
  readonly chpHeat: number;
  readonly chpCo2: number;
  /** Into the battery (from spare power or the night grid), and out of it. */
  readonly charged: number;
  readonly discharged: number;
  readonly bought: number;
  readonly sold: number;
  /** kWh in the battery at the end of the hour. */
  readonly stored: number;
  readonly costs: EnergyCosts;
  readonly total: number;
}

/**
 * Runs the power supply for the hour that starts at `gameHour`. The CHP runs
 * when that makes the hour cheaper. Without `gridCharging` (the player
 * cannot pay), the battery only takes spare power.
 */
export function runEnergy(
  energy: Energy,
  demand: EnergyDemand,
  gameHour: number,
  content: GameContent,
  { gridCharging = true }: { gridCharging?: boolean } = {},
): EnergyHour {
  const prices = hourPrices(gameHour, content);
  const peak =
    energy.solar > 0 ? levelAt(content.energy.solar, energy.solar).peak : 0;
  const battery =
    energy.battery > 0 ? levelAt(content.energy.battery, energy.battery) : null;
  // At night the battery fills from the grid only as far as tomorrow's spare
  // solar power will not, judging tomorrow's use by this hour's.
  let spareTomorrow = 0;
  for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
    spareTomorrow += Math.max(0, peak * sunshine(hour, content) - demand.power);
  }
  const nightTarget = battery
    ? Math.max(0, battery.capacity - spareTomorrow * battery.efficiency)
    : 0;
  const supply = (chp: ChpLevel | null) =>
    supplyHour({
      energy,
      demand,
      prices,
      solar: peak * sunshine(gameHour, content),
      battery,
      nightTarget,
      chp,
      gridCharging,
    });

  const off = supply(null);
  if (energy.chp === 0) return off;
  const on = supply(levelAt(content.energy.chp, energy.chp));
  return on.total < off.total ? on : off;
}

function supplyHour({
  energy,
  demand,
  prices,
  solar,
  battery,
  nightTarget,
  chp,
  gridCharging,
}: {
  energy: Energy;
  demand: EnergyDemand;
  prices: HourPrices;
  solar: number;
  battery: BatteryLevel | null;
  /** kWh the battery fills up to from the night grid. */
  nightTarget: number;
  chp: ChpLevel | null;
  gridCharging: boolean;
}): EnergyHour {
  // CHP heat goes to the heaters first: gas heaters burn less, heat pumps
  // draw less power. Spare heat is lost.
  let heatLeft = chp?.heat ?? 0;
  let heatingGas = 0;
  let power = demand.power;
  for (const heater of demand.heat) {
    const covered = Math.min(heatLeft, heater.kwh);
    heatLeft -= covered;
    const rest = heater.kwh - covered;
    if (heater.fuel === 'gas') heatingGas += rest / heater.efficiency;
    else power -= covered / heater.efficiency;
  }
  const chpHeat = (chp?.heat ?? 0) - heatLeft;

  // CHP CO₂ goes to the injectors, saving what they would buy.
  let co2Left = chp?.co2 ?? 0;
  let co2Cost = 0;
  for (const injector of demand.co2) {
    const covered = Math.min(co2Left, injector.units);
    co2Left -= covered;
    co2Cost += ((injector.units - covered) * injector.costPer1000) / 1000;
  }
  const chpCo2 = (chp?.co2 ?? 0) - co2Left;

  // Own power first, then the battery, then the grid.
  const own = solar + (chp?.power ?? 0);
  let spare = Math.max(0, own - power);
  let missing = Math.max(0, power - own);
  let stored = energy.stored;
  let charged = 0;
  let discharged = 0;
  let gridCharge = 0;
  if (battery) {
    const room = () => (battery.capacity - stored) / battery.efficiency;
    // Spare power fills the battery before any is sold.
    const fromSpare = Math.min(spare, battery.rate, room());
    spare -= fromSpare;
    stored += fromSpare * battery.efficiency;
    charged += fromSpare;
    if (prices.offPeak) {
      // Cheap night power fills it up to the night target, for the dear
      // hours; the sun fills the rest.
      if (gridCharging && stored < nightTarget) {
        gridCharge = Math.min(
          battery.rate - fromSpare,
          (nightTarget - stored) / battery.efficiency,
        );
        stored += gridCharge * battery.efficiency;
        charged += gridCharge;
      }
    } else {
      discharged = Math.min(missing, battery.rate, stored);
      stored -= discharged;
      missing -= discharged;
    }
  }
  const bought = missing + gridCharge;
  const sold = spare;

  const costs: EnergyCosts = {
    power: bought * prices.buy,
    powerSold: sold * prices.sell,
    heating: heatingGas * prices.gas,
    co2: co2Cost,
    chpFuel: chp
      ? chp.input * (chp.fuel === 'gas' ? prices.gas : prices.biogas)
      : 0,
  };
  return {
    prices,
    demand: power,
    solar,
    chp: chp?.power ?? 0,
    chpHeat,
    chpCo2,
    charged,
    discharged,
    bought,
    sold,
    stored,
    costs,
    total:
      costs.power - costs.powerSold + costs.heating + costs.co2 + costs.chpFuel,
  };
}

/** The energy system after an hour: the battery's new charge. */
export function afterHour(energy: Energy, hour: EnergyHour): Energy {
  return { ...energy, stored: hour.stored };
}

/** What an hour of the energy system adds to the books. */
export function energyEntry(hour: EnergyHour): BookEntry {
  return {
    power: hour.costs.power,
    powerSold: hour.costs.powerSold,
    fuel: hour.costs.heating + hour.costs.chpFuel,
    co2: hour.costs.co2,
    solarKwh: hour.solar,
    chpKwh: hour.chp,
    boughtKwh: hour.bought,
    soldKwh: hour.sold,
  };
}

export function initialEnergy(): Energy {
  return { solar: 0, battery: 0, chp: 0, stored: 0 };
}
