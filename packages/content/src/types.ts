export const CLIMATE_VARIABLES = [
  'temperature',
  'humidity',
  'co2',
  'light',
  'water',
  'nutrients',
] as const;

export type ClimateVariable = (typeof CLIMATE_VARIABLES)[number];

/**
 * Greenhouse climate. Units: temperature °C, humidity % RH, co2 ppm,
 * light PAR µmol/m²/s, water substrate moisture %, nutrients EC mS/cm.
 */
export type Climate = Readonly<Record<ClimateVariable, number>>;

/** The climate variables in the air; water and nutrients are in the substrate. */
export const AIR_VARIABLES = [
  'temperature',
  'humidity',
  'co2',
  'light',
] as const;

export type AirVariable = (typeof AIR_VARIABLES)[number];

/** From the quickest crop to the slowest. */
export const CROP_IDS = [
  'microgreens',
  'cucumber',
  'strawberry',
  'tomato',
  'pepper',
] as const;

export type CropId = (typeof CROP_IDS)[number];

/**
 * How a crop responds to one climate variable. The growth factor is 1 between
 * optimalLow and optimalHigh and falls linearly to 0 at limitLow and limitHigh.
 */
export interface ClimateResponse {
  readonly limitLow: number;
  readonly optimalLow: number;
  readonly optimalHigh: number;
  readonly limitHigh: number;
  /** Weight of this variable in the growth geometric mean. */
  readonly growthWeight: number;
  /** Stress per tick at factor 0 when the value is below the optimal band. */
  readonly stressBelow: number;
  /** Stress per tick at factor 0 when the value is above the optimal band. */
  readonly stressAbove: number;
}

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;

export type Season = (typeof SEASONS)[number];

export interface CropDef {
  readonly name: string;
  /** In-game hours (ticks) to maturity when every climate factor is 1. */
  readonly growthHours: number;
  /** Units harvested from one plot. */
  readonly yieldPerPlot: number;
  /** Price of the seeds (or young plants) for one plot. */
  readonly seedCost: number;
  /** Market price per unit at full quality, before seasons and swings. */
  readonly basePrice: number;
  /** Price multiplier at the middle of each season; it changes gradually in between. */
  readonly seasonalPrice: Readonly<Record<Season, number>>;
  /** Water one plot uses per hour of growth, in moisture % points. */
  readonly waterUse: number;
  /** Nutrients one plot uses per hour of growth, in EC (mS/cm). */
  readonly nutrientUse: number;
  /** In-game days the harvest keeps in storage: freshness falls to 0 over this time. */
  readonly shelfLifeDays: number;
  readonly climate: Readonly<Record<ClimateVariable, ClimateResponse>>;
}

export interface TimeConfig {
  /** Real milliseconds per tick (one in-game hour). */
  readonly realMsPerTick: number;
  /** In-game days per season; a year is four seasons. */
  readonly daysPerSeason: number;
  /**
   * Longest stretch of real time simulated after a break (app closed or
   * asleep). Anything beyond it is skipped.
   */
  readonly maxCatchUpMs: number;
}

export interface EconomyConfig {
  readonly startingMoney: number;
}

export interface GrowthConfig {
  /** How strongly average stress per hour lowers final quality. */
  readonly stressQualityPenalty: number;
}

/** Topping up one greenhouse resource (water or nutrients) by hand. */
export interface TopUpConfig {
  /** Added per top-up: moisture % points for water, EC for nutrients. */
  readonly amount: number;
  readonly cost: number;
  /** Nothing is added beyond this. */
  readonly max: number;
}

export interface CareConfig {
  readonly water: TopUpConfig;
  readonly nutrients: TopUpConfig;
}

export interface StorageConfig {
  /** Units of produce the storage holds. */
  readonly capacity: number;
}

/**
 * Market prices: each crop's price is its base price × the season's
 * multiplier × a swing factor that wanders a little every tick.
 */
export interface MarketConfig {
  /** Share of the way back to a swing of 1 each tick. */
  readonly reversion: number;
  /** Largest random change of the swing in one tick. */
  readonly volatility: number;
  readonly minSwing: number;
  readonly maxSwing: number;
}

/** The weather outside. Steady until weather and seasons arrive (Phase 10). */
export interface OutsideConfig {
  readonly temperature: number;
  readonly humidity: number;
  readonly co2: number;
  /** Light in the open, PAR. */
  readonly sunlight: number;
}

/**
 * How a greenhouse's air responds to the weather, the plants and the
 * equipment. Flows are per plot, so the climate does not depend on the
 * greenhouse's size (its energy use and running costs do).
 *
 * Moisture is counted in humidity points at one air change per hour: adding
 * m an hour while the air changes a times an hour raises humidity by m / a
 * points. CO₂ is counted the same way, in ppm.
 */
export interface ClimatePhysicsConfig {
  readonly outside: OutsideConfig;
  /** Heat from the sun, kW per plot for each PAR that comes through the glass. */
  readonly sunHeat: number;
  /** Heat (kW per °C per plot) carried out by each air change an hour through the vents. */
  readonly ventHeatLoss: number;
  /** Humidity points the heater dries the air by, per kW of heat per plot. */
  readonly heatingDries: number;
  /** Cooling (kW per plot) from each unit of fog that evaporates. */
  readonly fogCooling: number;
  /** Moisture a plot gives off per hour of growth. */
  readonly transpiration: number;
  /** CO₂ a plot takes up per hour of growth. */
  readonly co2Uptake: number;
  /** Share of the way to its balance the air moves each hour, 0 to 1. */
  readonly settle: Readonly<Record<AirVariable, number>>;
}

/** Energy prices, Volticoins per kWh. Power gets its own sources in Phase 7. */
export interface EnergyPricesConfig {
  readonly gas: number;
  readonly power: number;
}

/** Glass and size come in levels; a new greenhouse starts at level 1 of each. */
export interface GlassLevel {
  readonly name: string;
  readonly price: number;
  /** Heat lost through the glass, kW per °C (inside minus outside) per plot. */
  readonly heatLoss: number;
  /** Share of the sunlight that comes through. */
  readonly transmission: number;
  /** Air changes per hour through the gaps, with the vents shut. */
  readonly airChanges: number;
}

export interface SizeLevel {
  readonly name: string;
  readonly price: number;
  readonly plots: number;
}

export interface GreenhouseConfig {
  /**
   * A new greenhouse's climate: the balance of an empty greenhouse with the
   * first glass, plus its water and nutrients.
   */
  readonly startingClimate: Climate;
  readonly glass: readonly GlassLevel[];
  readonly sizes: readonly SizeLevel[];
  /** Sets every target for the crops growing, and idles when nothing grows. */
  readonly climateComputer: { readonly price: number };
}

export const EQUIPMENT_KINDS = [
  'heater',
  'vents',
  'fogger',
  'co2',
  'lights',
  'fertigation',
] as const;

export type EquipmentKind = (typeof EQUIPMENT_KINDS)[number];

interface EquipmentLevelBase {
  readonly name: string;
  /** Price to install this level, or to upgrade to it from the one before. */
  readonly price: number;
  /** Wear added per hour at full output; at 1 it is worn out. */
  readonly wearRate: number;
}

export interface HeaterLevel extends EquipmentLevelBase {
  /** Most heat it gives, kW per plot. */
  readonly heat: number;
  readonly fuel: 'gas' | 'power';
  /** Heat out per kWh in: below 1 for a burner, above 1 for a heat pump. */
  readonly efficiency: number;
  /** CO₂ its exhaust adds to the air per kWh of gas burned. */
  readonly exhaustCo2: number;
}

export interface VentLevel extends EquipmentLevelBase {
  /** Air changes per hour when fully open. */
  readonly airChanges: number;
  /** Fan power at full speed, kW per plot (0 for vents alone). */
  readonly power: number;
}

export interface FoggerLevel extends EquipmentLevelBase {
  /** Most moisture an hour, per plot. */
  readonly moisture: number;
  /** Pump power at full output, kW per plot. */
  readonly power: number;
  /** Price of the water, per unit of moisture per plot. */
  readonly waterCost: number;
}

export interface Co2Level extends EquipmentLevelBase {
  /** Most CO₂ an hour, per plot. */
  readonly dose: number;
  /** Price of the CO₂, per 1000 units of dose per plot. */
  readonly costPer1000: number;
}

export interface LightLevel extends EquipmentLevelBase {
  /** Most light the lamps add, PAR. */
  readonly par: number;
  /** Power, kW per plot for each PAR. */
  readonly powerPerPar: number;
  /** Heat the lamps give off, kW per plot for each PAR. */
  readonly heatPerPar: number;
}

export interface FertigationLevel extends EquipmentLevelBase {
  /** Most water added an hour, moisture % points. */
  readonly water: number;
  /** Most nutrients added an hour, EC. */
  readonly nutrients: number;
  /** Per % point of water. */
  readonly waterCost: number;
  /** Per EC of nutrients. */
  readonly nutrientCost: number;
  /** Pump power at full output, kW per plot. */
  readonly power: number;
}

export interface EquipmentLevels {
  readonly heater: readonly HeaterLevel[];
  readonly vents: readonly VentLevel[];
  readonly fogger: readonly FoggerLevel[];
  readonly co2: readonly Co2Level[];
  readonly lights: readonly LightLevel[];
  readonly fertigation: readonly FertigationLevel[];
}

export interface EquipmentConfig {
  readonly levels: EquipmentLevels;
  /** Share of its output a fully worn device loses. */
  readonly wearLoss: number;
  /** A service costs this share of the level's price, times the wear. */
  readonly serviceShare: number;
}

/** The targets the equipment works to. */
export const SETPOINT_IDS = [
  'heatTo',
  'ventAbove',
  'humidityMax',
  'humidityMin',
  'co2',
  'light',
  'water',
  'nutrients',
] as const;

export type SetpointId = (typeof SETPOINT_IDS)[number];

export type Setpoints = Readonly<Record<SetpointId, number>>;

/** The setpoints each kind of equipment works to. */
export const EQUIPMENT_SETPOINTS: Readonly<
  Record<EquipmentKind, readonly SetpointId[]>
> = {
  heater: ['heatTo'],
  vents: ['ventAbove', 'humidityMax'],
  fogger: ['humidityMin'],
  co2: ['co2'],
  lights: ['light'],
  fertigation: ['water', 'nutrients'],
};

export interface SetpointRange {
  readonly min: number;
  readonly max: number;
  /** Step of the player's controls. */
  readonly step: number;
}

export interface ControlConfig {
  readonly ranges: Readonly<Record<SetpointId, SetpointRange>>;
  /** The setpoints a new greenhouse starts with. */
  readonly initial: Setpoints;
  /** Smallest gap between the heating and venting temperatures, °C. */
  readonly temperatureGap: number;
  /** Smallest gap between the fogger's and the vents' humidity, % points. */
  readonly humidityGap: number;
}

export interface GameContent {
  readonly time: TimeConfig;
  readonly crops: Readonly<Record<CropId, CropDef>>;
  readonly economy: EconomyConfig;
  readonly growth: GrowthConfig;
  readonly care: CareConfig;
  readonly storage: StorageConfig;
  readonly market: MarketConfig;
  readonly greenhouse: GreenhouseConfig;
  readonly physics: ClimatePhysicsConfig;
  readonly energyPrices: EnergyPricesConfig;
  readonly equipment: EquipmentConfig;
  readonly control: ControlConfig;
}
