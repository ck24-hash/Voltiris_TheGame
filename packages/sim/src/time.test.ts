import { defaultContent } from '@voltiris/content';
import { describe, expect, it } from 'vitest';
import { getCalendar } from './time';

const time = defaultContent.time; // 15 days per season

describe('getCalendar', () => {
  it('starts at midnight on day 1 of spring, year 1', () => {
    expect(getCalendar(0, time)).toEqual({
      year: 1,
      season: 'spring',
      dayOfSeason: 1,
      day: 1,
      hour: 0,
    });
  });

  it('rolls over hours into days', () => {
    expect(getCalendar(23, time)).toMatchObject({ day: 1, hour: 23 });
    expect(getCalendar(24, time)).toMatchObject({ day: 2, hour: 0 });
    expect(getCalendar(24 * 3 + 14, time)).toMatchObject({
      day: 4,
      dayOfSeason: 4,
      hour: 14,
    });
  });

  it('moves through the four seasons every 15 days', () => {
    const seasonOnDay = (day: number) => getCalendar((day - 1) * 24, time);
    expect(seasonOnDay(15)).toMatchObject({
      season: 'spring',
      dayOfSeason: 15,
    });
    expect(seasonOnDay(16)).toMatchObject({ season: 'summer', dayOfSeason: 1 });
    expect(seasonOnDay(31).season).toBe('autumn');
    expect(seasonOnDay(46).season).toBe('winter');
    expect(seasonOnDay(60)).toMatchObject({ season: 'winter', year: 1 });
  });

  it('starts a new year after winter', () => {
    expect(getCalendar(60 * 24, time)).toEqual({
      year: 2,
      season: 'spring',
      dayOfSeason: 1,
      day: 61,
      hour: 0,
    });
  });
});
