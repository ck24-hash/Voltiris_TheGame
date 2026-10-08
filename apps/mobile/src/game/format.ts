import type { ClimateVariable, Season } from '@voltiris/content';
import type { Calendar } from '@voltiris/sim';
import { GAUGES } from './gauges';

const CURRENCY = { singular: 'Volticoin', plural: 'Volticoins' };

const wholeNumber = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

/** "1,250", rounded down so the player never sees money they lack. */
export function formatCoins(amount: number): string {
  return wholeNumber.format(Math.floor(amount));
}

/** "1 Volticoin", "1,250 Volticoins". */
export function formatCoinsLong(amount: number): string {
  const whole = Math.floor(amount);
  return `${formatCoins(whole)} ${whole === 1 ? CURRENCY.singular : CURRENCY.plural}`;
}

/** Unit prices keep their cents: "1.60". */
export function formatPrice(amount: number): string {
  return amount.toFixed(2);
}

/** "Day 4 · 14:00". */
export function formatDayTime(cal: Calendar): string {
  return `Day ${cal.day} · ${String(cal.hour).padStart(2, '0')}:00`;
}

const SEASON_NAMES: Record<Season, string> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
};

/** "Spring · Year 1". */
export function formatSeason(cal: Calendar): string {
  return `${SEASON_NAMES[cal.season]} · Year ${cal.year}`;
}

/** "20.0 °C", "420 ppm", "70%". */
export function formatClimate(
  variable: ClimateVariable,
  value: number,
): string {
  const { unit, decimals } = GAUGES[variable];
  const number = value.toFixed(decimals);
  return unit === '%' ? `${number}%` : `${number} ${unit}`;
}

/** In-game duration: "5 d 3 h", "7 h". */
export function formatGameHours(hours: number): string {
  if (!Number.isFinite(hours)) return 'never';
  const days = Math.floor(hours / 24);
  const rest = Math.round(hours % 24);
  if (days === 0) return `${rest} h`;
  return rest === 0 ? `${days} d` : `${days} d ${rest} h`;
}

/** Real-world duration: "about 2 h 15 min", "about 45 s". */
export function formatRealDuration(ms: number): string {
  if (!Number.isFinite(ms)) return 'never';
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `about ${totalSeconds} s`;
  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `about ${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `about ${hours} h` : `about ${hours} h ${minutes} min`;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
