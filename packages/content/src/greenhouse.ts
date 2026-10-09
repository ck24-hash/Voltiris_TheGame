import type {
  ClimatePhysicsConfig,
  ControlConfig,
  GreenhouseConfig,
} from './types';

// Starting values; balanced in Phase 11.

// A mild, bright day. The single glass keeps 8 °C of the sun's heat in, so
// an empty greenhouse settles at 20 °C; the plants add a little humidity
// and take a little CO₂.
export const PHYSICS: ClimatePhysicsConfig = {
  outside: { temperature: 12, humidity: 60, co2: 420, sunlight: 500 },
  sunHeat: 0.004,
  ventHeatLoss: 0.05,
  heatingDries: 3,
  fogCooling: 0.01,
  transpiration: 4,
  co2Uptake: 20,
  settle: { temperature: 0.6, humidity: 0.6, co2: 0.8, light: 1 },
};

export const GREENHOUSE: GreenhouseConfig = {
  startingClimate: {
    temperature: 20,
    humidity: 60,
    co2: 420,
    light: 400,
    water: 65,
    nutrients: 2.5,
  },
  // Better insulation keeps the sun's heat in: warmer for free, but it needs
  // venting for crops that like it cool.
  glass: [
    {
      name: 'Single glass',
      price: 0,
      heatLoss: 0.2,
      transmission: 0.8,
      airChanges: 1,
    },
    {
      name: 'Double glass',
      price: 500,
      heatLoss: 0.12,
      transmission: 0.72,
      airChanges: 0.6,
    },
    {
      name: 'Diffuse glass',
      price: 1200,
      heatLoss: 0.12,
      transmission: 0.85,
      airChanges: 0.6,
    },
  ],
  sizes: [
    { name: 'Small', price: 0, plots: 4 },
    { name: 'Medium', price: 600, plots: 6 },
    { name: 'Large', price: 1500, plots: 8 },
  ],
  climateComputer: { price: 600 },
};

// The starting targets suit every crop's temperature band and most of the
// others, so new equipment helps straight away.
export const CONTROL: ControlConfig = {
  ranges: {
    heatTo: { min: 10, max: 30, step: 1 },
    ventAbove: { min: 15, max: 40, step: 1 },
    humidityMax: { min: 40, max: 100, step: 5 },
    humidityMin: { min: 30, max: 90, step: 5 },
    co2: { min: 400, max: 1500, step: 50 },
    light: { min: 0, max: 1000, step: 50 },
    water: { min: 30, max: 90, step: 5 },
    nutrients: { min: 0.5, max: 5, step: 0.1 },
  },
  initial: {
    heatTo: 23,
    ventAbove: 25,
    humidityMax: 85,
    humidityMin: 75,
    co2: 800,
    light: 500,
    water: 65,
    nutrients: 2.5,
  },
  temperatureGap: 1,
  humidityGap: 5,
};
