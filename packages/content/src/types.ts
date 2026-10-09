export const CLIMATE_VARIABLES = [
  'temperature',
  'humidity',
  'co2',
  'light',
  'water',
] as const;

export type ClimateVariable = (typeof CLIMATE_VARIABLES)[number];

/**
 * Greenhouse climate. Units: temperature °C, humidity % RH, co2 ppm,
 * light PAR µmol/m²/s, water substrate moisture %.
 */
export type Climate = Readonly<Record<ClimateVariable, number>>;

/** The climate variables in the air; water is in the soil. */
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
  /** What the market pays per unit at full quality and freshness; it does not change. */
  readonly price: number;
  /** Water one plot uses per hour of growth, in moisture % points. */
  readonly waterUse: number;
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
  /**
   * Running costs never take money below this, so there is always enough
   * for seeds: the equipment pauses instead.
   */
  readonly reserve: number;
}

export interface GrowthConfig {
  /** How strongly average stress per hour lowers final quality. */
  readonly stressQualityPenalty: number;
}

/** Watering a greenhouse by hand. */
export interface TopUpConfig {
  /** Moisture % points added per watering. */
  readonly amount: number;
  readonly cost: number;
  /** Nothing is added beyond this. */
  readonly max: number;
}

export interface CareConfig {
  readonly water: TopUpConfig;
}

export interface StorageConfig {
  /** Units of produce the storage holds. */
  readonly capacity: number;
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
  /** Moisture a plot gives off per hour of growth. */
  readonly transpiration: number;
  /** CO₂ a plot takes up per hour of growth. */
  readonly co2Uptake: number;
  /** Share of the way to its balance the air moves each hour, 0 to 1. */
  readonly settle: Readonly<Record<AirVariable, number>>;
}

/** A band of the grid's tariff: from `from` o'clock until the next band starts. */
export interface TariffBand {
  readonly name: string;
  readonly from: number;
  /** Volticoins per kWh. */
  readonly price: number;
}

export interface GridConfig {
  /** From midnight; the last band runs until midnight. */
  readonly tariff: readonly TariffBand[];
  /** Price multiplier at the middle of each season; it changes gradually in between. */
  readonly seasonal: Readonly<Record<Season, number>>;
  /** Selling spare power pays this share of the buying price. */
  readonly sellShare: number;
}

/**
 * When the sun is up for the solar panels: none before `rise` or after
 * `set`, most at midday. The greenhouse keeps a steady light until weather
 * and seasons arrive (Phase 10).
 */
export interface SunConfig {
  readonly rise: number;
  readonly set: number;
}

export const ENERGY_ASSETS = ['solar', 'battery', 'chp'] as const;

export type EnergyAsset = (typeof ENERGY_ASSETS)[number];

export interface SolarLevel {
  readonly name: string;
  readonly price: number;
  /** Output at midday, kW. */
  readonly peak: number;
}

export interface BatteryLevel {
  readonly name: string;
  readonly price: number;
  /** kWh it holds. */
  readonly capacity: number;
  /** Fastest it charges or discharges, kW. */
  readonly rate: number;
  /** Share of the power put in that comes back out. */
  readonly efficiency: number;
}

/** A combined heat and power unit: an engine that makes power, heat and CO₂. */
export interface ChpLevel {
  readonly name: string;
  readonly price: number;
  readonly fuel: 'gas' | 'biogas';
  /** Fuel it burns when running, kW. */
  readonly input: number;
  /** Power it makes, kW. */
  readonly power: number;
  /** Heat it gives the greenhouse heaters, kW. */
  readonly heat: number;
  /** CO₂ from its cleaned exhaust per hour, for the injectors (as a dose). */
  readonly co2: number;
}

export interface EnergyConfig {
  /** Volticoins per kWh of fuel. */
  readonly prices: { readonly gas: number; readonly biogas: number };
  readonly grid: GridConfig;
  readonly sun: SunConfig;
  readonly solar: readonly SolarLevel[];
  readonly battery: readonly BatteryLevel[];
  readonly chp: readonly ChpLevel[];
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
   * first glass, plus its water.
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
  'irrigation',
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

export interface IrrigationLevel extends EquipmentLevelBase {
  /** Most water added an hour, moisture % points. */
  readonly water: number;
  /** Per % point of water. */
  readonly waterCost: number;
  /** Pump power at full output, kW per plot. */
  readonly power: number;
}

export interface EquipmentLevels {
  readonly heater: readonly HeaterLevel[];
  readonly vents: readonly VentLevel[];
  readonly fogger: readonly FoggerLevel[];
  readonly co2: readonly Co2Level[];
  readonly lights: readonly LightLevel[];
  readonly irrigation: readonly IrrigationLevel[];
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
  irrigation: ['water'],
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
  readonly greenhouse: GreenhouseConfig;
  readonly physics: ClimatePhysicsConfig;
  readonly energy: EnergyConfig;
  readonly equipment: EquipmentConfig;
  readonly control: ControlConfig;
}
