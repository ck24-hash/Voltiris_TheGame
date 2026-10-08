import {
  CROP_IDS,
  SEASONS,
  type CropDef,
  type CropId,
  type GameContent,
  type MarketConfig,
  type Season,
  type TimeConfig,
} from '@voltiris/content';
import type { Rng } from './rng';
import type { Market } from './state';
import { HOURS_PER_DAY } from './time';

// Prices use only + − × ÷ (no Math.sin or Math.exp), so every device
// computes exactly the same prices from the same game.

/** A market with every crop at its normal price. */
export function initialMarket(): Market {
  return {
    swings: Object.fromEntries(CROP_IDS.map((id) => [id, 1])) as Record<
      CropId,
      number
    >,
  };
}

/**
 * The crop's seasonal price multiplier at a game hour. Each season's value
 * holds at its middle; in between, the price moves in a straight line
 * towards the next season's.
 */
export function seasonalFactor(
  crop: CropDef,
  gameHour: number,
  time: TimeConfig,
): number {
  const seasonHours = time.daysPerSeason * HOURS_PER_DAY;
  const yearHours = seasonHours * SEASONS.length;
  // Seasons since the middle of spring, within one year: from -0.5 to 3.5.
  const t = (gameHour % yearHours) / seasonHours - 0.5;
  const from = Math.floor(t);
  const a = crop.seasonalPrice[seasonAt(from)];
  const b = crop.seasonalPrice[seasonAt(from + 1)];
  return a + (b - a) * (t - from);
}

function seasonAt(index: number): Season {
  const season = SEASONS[(index + SEASONS.length) % SEASONS.length];
  if (!season) throw new RangeError(`No season at ${index}`);
  return season;
}

/** What one unit sells for now, at full quality and freshness. */
export function cropPrice(
  market: Market,
  cropId: CropId,
  gameHour: number,
  content: GameContent,
): number {
  const crop = content.crops[cropId];
  return (
    crop.basePrice *
    seasonalFactor(crop, gameHour, content.time) *
    market.swings[cropId]
  );
}

/**
 * Moves every crop's swing by one tick: part of the way back to 1, plus a
 * small random step, kept within the configured range.
 */
export function tickMarket(
  market: Market,
  rng: Rng,
  config: MarketConfig,
): Market {
  const swings = {} as Record<CropId, number>;
  // A fixed crop order keeps the random draws, and so the prices, repeatable.
  for (const id of CROP_IDS) {
    const swing = market.swings[id];
    const step = config.volatility * (2 * rng.next() - 1);
    const next = swing + config.reversion * (1 - swing) + step;
    swings[id] = Math.min(config.maxSwing, Math.max(config.minSwing, next));
  }
  return { swings };
}
