import {
  CROP_IDS,
  defaultContent,
  SEASONS,
  type MarketConfig,
} from '@voltiris/content';
import { describe, expect, it } from 'vitest';
import { cropPrice, initialMarket, seasonalFactor, tickMarket } from './market';
import { createRng, seedRng } from './rng';
import type { Market } from './state';
import { HOURS_PER_DAY } from './time';

const { crops, time } = defaultContent;
const SEASON_HOURS = time.daysPerSeason * HOURS_PER_DAY;
const YEAR_HOURS = SEASON_HOURS * SEASONS.length;

describe('seasonalFactor', () => {
  it.each(CROP_IDS)(
    "is %s's value for each season at the middle of that season",
    (id) => {
      SEASONS.forEach((season, k) => {
        const middle = SEASON_HOURS * (k + 0.5);
        expect(seasonalFactor(crops[id], middle, time)).toBeCloseTo(
          crops[id].seasonalPrice[season],
          12,
        );
      });
    },
  );

  it('is halfway between two seasons where they meet', () => {
    const { seasonalPrice } = crops.cucumber;
    expect(seasonalFactor(crops.cucumber, 0, time)).toBeCloseTo(
      (seasonalPrice.winter + seasonalPrice.spring) / 2,
      12,
    );
    expect(seasonalFactor(crops.cucumber, SEASON_HOURS, time)).toBeCloseTo(
      (seasonalPrice.spring + seasonalPrice.summer) / 2,
      12,
    );
  });

  it('moves gradually: no jump from one hour to the next', () => {
    const steps = Array.from({ length: YEAR_HOURS }, (_, hour) =>
      Math.abs(
        seasonalFactor(crops.tomato, hour + 1, time) -
          seasonalFactor(crops.tomato, hour, time),
      ),
    );
    expect(Math.max(...steps)).toBeLessThan(0.002);
  });

  it('repeats every year', () => {
    for (const hour of [0, 100, 777, YEAR_HOURS - 1]) {
      expect(seasonalFactor(crops.pepper, hour + YEAR_HOURS, time)).toBe(
        seasonalFactor(crops.pepper, hour, time),
      );
    }
  });
});

describe('cropPrice', () => {
  it('is the base price × the season × the market swing', () => {
    const market: Market = {
      swings: { ...initialMarket().swings, tomato: 1.2 },
    };
    const hour = 500;
    expect(cropPrice(market, 'tomato', hour, defaultContent)).toBeCloseTo(
      crops.tomato.basePrice * seasonalFactor(crops.tomato, hour, time) * 1.2,
      12,
    );
  });
});

describe('tickMarket', () => {
  const config = defaultContent.market;

  function run(ticks: number, seed = 9, market = initialMarket()) {
    const rng = createRng(seedRng(seed));
    const history: Market[] = [];
    let next = market;
    for (let k = 0; k < ticks; k++) {
      next = tickMarket(next, rng, config);
      history.push(next);
    }
    return { history, rng };
  }

  it('moves every crop a little each tick', () => {
    const [first] = run(1).history;
    for (const id of CROP_IDS) {
      const swing = first?.swings[id] ?? 1;
      expect(swing).not.toBe(1);
      expect(Math.abs(swing - 1)).toBeLessThanOrEqual(config.volatility);
    }
  });

  it('draws one random number per crop', () => {
    const { rng } = run(10);
    const expected = createRng(seedRng(9));
    for (let k = 0; k < 10 * CROP_IDS.length; k++) expected.next();
    expect(rng.snapshot()).toEqual(expected.snapshot());
  });

  it('gives the same prices for the same seed', () => {
    expect(run(200, 4).history).toEqual(run(200, 4).history);
    expect(run(200, 4).history).not.toEqual(run(200, 5).history);
  });

  it('pulls a swing back towards normal', () => {
    const calm: MarketConfig = { ...config, volatility: 0 };
    const high: Market = {
      swings: { ...initialMarket().swings, pepper: 1.5 },
    };
    const next = tickMarket(high, createRng(seedRng(1)), calm);
    expect(next.swings.pepper).toBeCloseTo(1.5 - config.reversion * 0.5, 12);
  });

  it('never leaves the allowed range', () => {
    const wild: MarketConfig = { ...config, volatility: 0.5 };
    const rng = createRng(seedRng(3));
    let market = initialMarket();
    for (let k = 0; k < 2000; k++) {
      market = tickMarket(market, rng, wild);
      for (const id of CROP_IDS) {
        expect(market.swings[id]).toBeGreaterThanOrEqual(config.minSwing);
        expect(market.swings[id]).toBeLessThanOrEqual(config.maxSwing);
      }
    }
  });

  it('stays around normal over a long time, within about ±10% mostly', () => {
    const { history } = run(20_000);
    const swings = history.map((m) => m.swings.cucumber);
    const mean = swings.reduce((a, b) => a + b, 0) / swings.length;
    expect(mean).toBeGreaterThan(0.97);
    expect(mean).toBeLessThan(1.03);
    const within = swings.filter((s) => Math.abs(s - 1) <= 0.15).length;
    expect(within / swings.length).toBeGreaterThan(0.9);
  });
});
