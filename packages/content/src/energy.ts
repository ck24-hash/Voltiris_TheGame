import type { EnergyConfig } from './types';

// Starting values; balanced in Phase 11.
export const ENERGY: EnergyConfig = {
  prices: { gas: 0.04, biogas: 0.025 },
  grid: {
    // Cheap at night, dear in the evening when everyone cooks.
    tariff: [
      { name: 'Night', from: 0, price: 0.05 },
      { name: 'Day', from: 7, price: 0.08 },
      { name: 'Peak', from: 17, price: 0.14 },
      { name: 'Evening', from: 21, price: 0.08 },
      { name: 'Night', from: 23, price: 0.05 },
    ],
    seasonal: { spring: 1, summer: 0.9, autumn: 1.05, winter: 1.2 },
    sellShare: 0.5,
  },
  sun: { rise: 6, set: 20 },
  solar: [
    { name: 'Rooftop panels', price: 300, peak: 3 },
    { name: 'Solar field', price: 800, peak: 8 },
    { name: 'Large solar field', price: 2000, peak: 20 },
  ],
  battery: [
    {
      name: 'Home battery',
      price: 400,
      capacity: 10,
      rate: 4,
      efficiency: 0.9,
    },
    {
      name: 'Battery bank',
      price: 1000,
      capacity: 30,
      rate: 10,
      efficiency: 0.92,
    },
    {
      name: 'Battery container',
      price: 2400,
      capacity: 80,
      rate: 25,
      efficiency: 0.94,
    },
  ],
  // 40% of the fuel becomes power and 50% useful heat.
  chp: [
    {
      name: 'Gas CHP',
      price: 900,
      fuel: 'gas',
      input: 10,
      power: 4,
      heat: 5,
      co2: 1200,
    },
    {
      name: 'Biogas CHP',
      price: 2200,
      fuel: 'biogas',
      input: 20,
      power: 8,
      heat: 10,
      co2: 2400,
    },
  ],
};
