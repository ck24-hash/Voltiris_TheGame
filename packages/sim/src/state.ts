import type {
  Climate,
  CropId,
  EquipmentKind,
  Setpoints,
} from '@voltiris/content';
import type { RngState } from './rng';

/**
 * Save schema version. Bump it and add a migration (with a test) whenever the
 * shape of GameState changes.
 */
export const STATE_VERSION = 4;

export interface GameState {
  readonly version: number;
  /** UUID, ready for online accounts later. */
  readonly playerId: string;
  readonly clock: GameClock;
  readonly rng: RngState;
  /** Volticoins, always a whole number. */
  readonly money: number;
  /**
   * Running costs not paid yet, always below one Volticoin: whole coins are
   * paid every hour and the rest carries over.
   */
  readonly owed: number;
  readonly greenhouses: readonly Greenhouse[];
  readonly storage: Storage;
  readonly market: Market;
  readonly energy: Energy;
}

/** The power supply the greenhouses share: the grid, plus what the player builds. */
export interface Energy {
  /** Level of each asset; 0 when there is none. */
  readonly solar: number;
  readonly battery: number;
  readonly chp: number;
  /** kWh in the battery. */
  readonly stored: number;
  /** Energy and what it cost so far today (since 00:00). */
  readonly today: EnergyDay;
  /** The whole of yesterday; null on the first day. */
  readonly yesterday: EnergyDay | null;
}

export interface EnergyDay {
  /** kWh the solar panels and the CHP made, bought from and sold to the grid. */
  readonly solar: number;
  readonly chp: number;
  readonly bought: number;
  readonly sold: number;
  /** Volticoins: the grid (bought less sold), heater gas, CO₂, CHP fuel. */
  readonly power: number;
  readonly heating: number;
  readonly co2: number;
  readonly chpFuel: number;
}

export interface Storage {
  /** Harvests waiting to be sold, oldest first. */
  readonly lots: readonly StoredLot[];
}

/** One harvest in storage. */
export interface StoredLot {
  readonly id: string;
  readonly cropId: CropId;
  /** Whole units. */
  readonly units: number;
  /** 0–1, from how the crop grew. Freshness then falls with time. */
  readonly quality: number;
  readonly harvestedAtHour: number;
}

export interface Market {
  /**
   * Per crop, the market's current swing around the seasonal price (1 is
   * normal). Crop prices are base price × season × swing.
   */
  readonly swings: Readonly<Record<CropId, number>>;
}

export interface GameClock {
  /** In-game hours since the game started; one tick is one hour. */
  readonly gameHour: number;
  /** Real time (ms) at which the last tick was due. */
  readonly lastTickAt: number;
}

export interface Greenhouse {
  readonly id: string;
  readonly climate: Climate;
  readonly plots: readonly Plot[];
  /** Level of the glass (1 is the first in content). */
  readonly glass: number;
  /** Level of the size; the plots list grows with it. */
  readonly size: number;
  readonly equipment: InstalledEquipment;
  /** The player's targets for the equipment. */
  readonly setpoints: Setpoints;
  /** A climate computer is installed. */
  readonly computer: boolean;
  /** The climate computer sets the targets, instead of the player's setpoints. */
  readonly auto: boolean;
}

/** One device of each kind at most; a kind that is missing is not installed. */
export type InstalledEquipment = Readonly<
  Partial<Record<EquipmentKind, Equipment>>
>;

export interface Equipment {
  /** 1 is the first level in content. */
  readonly level: number;
  /** 0 when new, 1 when worn out; a worn device gives less. */
  readonly wear: number;
}

export interface Plot {
  readonly id: string;
  readonly planting: Planting | null;
}

interface PlantingBase {
  readonly cropId: CropId;
  readonly plantedAtHour: number;
  /** Growth so far, in hours of optimal growth. */
  readonly growthHours: number;
  /** Sum of the stress added each tick while growing. */
  readonly stress: number;
}

export interface GrowingPlanting extends PlantingBase {
  readonly status: 'growing';
}

export interface ReadyPlanting extends PlantingBase {
  readonly status: 'ready';
  readonly readyAtHour: number;
  /** 0–1, from the average stress per hour while growing. */
  readonly quality: number;
  readonly yieldUnits: number;
}

export type Planting = GrowingPlanting | ReadyPlanting;
