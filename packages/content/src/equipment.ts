import type { EquipmentConfig } from './types';

// Starting values; balanced in Phase 11. Flows and power are per plot, so
// one device covers a greenhouse of any size; a bigger greenhouse costs more
// to run.
export const EQUIPMENT: EquipmentConfig = {
  levels: {
    // Gas first: cheap heat, and the exhaust adds a little CO₂. The heat
    // pump runs on power and gives four times the heat it uses.
    heater: [
      {
        name: 'Gas heater',
        price: 150,
        wearRate: 0.0025,
        heat: 0.8,
        fuel: 'gas',
        efficiency: 0.85,
        exhaustCo2: 30,
      },
      {
        name: 'Hot-water pipes',
        price: 500,
        wearRate: 0.0015,
        heat: 1.6,
        fuel: 'gas',
        efficiency: 0.95,
        exhaustCo2: 30,
      },
      {
        name: 'Heat pump',
        price: 1200,
        wearRate: 0.001,
        heat: 2.4,
        fuel: 'power',
        efficiency: 4,
        exhaustCo2: 0,
      },
    ],
    vents: [
      {
        name: 'Roof vents',
        price: 100,
        wearRate: 0.001,
        airChanges: 6,
        power: 0,
      },
      {
        name: 'Fans',
        price: 400,
        wearRate: 0.0015,
        airChanges: 15,
        power: 0.03,
      },
    ],
    fogger: [
      {
        name: 'Fog nozzles',
        price: 120,
        wearRate: 0.002,
        moisture: 12,
        power: 0.02,
        waterCost: 0.002,
      },
      {
        name: 'High-pressure fog',
        price: 400,
        wearRate: 0.0012,
        moisture: 25,
        power: 0.03,
        waterCost: 0.002,
      },
    ],
    co2: [
      {
        name: 'CO₂ bottles',
        price: 150,
        wearRate: 0.001,
        dose: 400,
        costPer1000: 0.06,
      },
      {
        name: 'CO₂ tank',
        price: 450,
        wearRate: 0.0008,
        dose: 800,
        costPer1000: 0.04,
      },
    ],
    lights: [
      {
        name: 'Sodium lamps',
        price: 250,
        wearRate: 0.0015,
        par: 150,
        powerPerPar: 0.002,
        heatPerPar: 0.0015,
      },
      {
        name: 'LED lights',
        price: 800,
        wearRate: 0.0008,
        par: 300,
        powerPerPar: 0.0012,
        heatPerPar: 0.0004,
      },
    ],
    // Half the price of watering and feeding by hand, and it never forgets.
    fertigation: [
      {
        name: 'Drip fertigation',
        price: 150,
        wearRate: 0.001,
        water: 4,
        nutrients: 0.1,
        waterCost: 0.1,
        nutrientCost: 5,
        power: 0.01,
      },
      {
        name: 'Recirculating fertigation',
        price: 450,
        wearRate: 0.0006,
        water: 8,
        nutrients: 0.2,
        waterCost: 0.05,
        nutrientCost: 2.5,
        power: 0.01,
      },
    ],
  },
  wearLoss: 0.5,
  serviceShare: 0.25,
};
