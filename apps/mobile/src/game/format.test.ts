import { describe, expect, it } from 'vitest';
import {
  formatClimate,
  formatCoins,
  formatCoinsLong,
  formatDayTime,
  formatGameHours,
  formatPercent,
  formatPrice,
  formatDuration,
  formatRealDuration,
  formatSeason,
} from './format';

describe('money', () => {
  it('shows whole Volticoins with thousands separators, rounded down', () => {
    expect(formatCoins(500)).toBe('500');
    expect(formatCoins(1250.99)).toBe('1,250');
    expect(formatCoins(1_000_000)).toBe('1,000,000');
  });

  it('names the currency', () => {
    expect(formatCoinsLong(1)).toBe('1 Volticoin');
    expect(formatCoinsLong(1.7)).toBe('1 Volticoin');
    expect(formatCoinsLong(2500)).toBe('2,500 Volticoins');
  });

  it('keeps cents on unit prices', () => {
    expect(formatPrice(1.6)).toBe('1.60');
    expect(formatPrice(2.4)).toBe('2.40');
  });
});

describe('time', () => {
  const cal = {
    year: 2,
    season: 'autumn',
    dayOfSeason: 3,
    day: 63,
    hour: 7,
  } as const;

  it('shows the day and hour', () => {
    expect(formatDayTime(cal)).toBe('Day 63 · 07:00');
    expect(formatDayTime({ ...cal, hour: 14 })).toBe('Day 63 · 14:00');
  });

  it('shows the season and year', () => {
    expect(formatSeason(cal)).toBe('Autumn · Year 2');
  });

  it('shows in-game durations in days and hours', () => {
    expect(formatGameHours(5)).toBe('5 h');
    expect(formatGameHours(48)).toBe('2 d');
    expect(formatGameHours(123)).toBe('5 d 3 h');
    expect(formatGameHours(Infinity)).toBe('never');
  });

  it('shows real-world durations', () => {
    expect(formatRealDuration(45_000)).toBe('about 45 s');
    expect(formatRealDuration(15 * 60_000)).toBe('about 15 min');
    expect(formatRealDuration(3 * 3_600_000)).toBe('about 3 h');
    expect(formatRealDuration(2 * 3_600_000 + 15 * 60_000)).toBe(
      'about 2 h 15 min',
    );
  });

  it('counts long breaks in days', () => {
    expect(formatDuration(24 * 3_600_000)).toBe('1 day');
    expect(formatDuration(3 * 24 * 3_600_000 + 4 * 3_600_000)).toBe(
      '3 days 4 h',
    );
  });
});

describe('climate and percentages', () => {
  it('uses each variable’s unit and precision', () => {
    expect(formatClimate('temperature', 20)).toBe('20.0 °C');
    expect(formatClimate('co2', 420)).toBe('420 ppm');
    expect(formatClimate('light', 400.4)).toBe('400 PAR');
    expect(formatClimate('humidity', 70)).toBe('70%');
    expect(formatClimate('nutrients', 2.5)).toBe('2.5 EC');
  });

  it('rounds percentages', () => {
    expect(formatPercent(0.817)).toBe('82%');
    expect(formatPercent(1)).toBe('100%');
  });
});
