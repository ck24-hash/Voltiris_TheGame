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
  return `Day ${cal.day} · ${formatHour(cal.hour)}`;
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

/** A climate range without needless decimals: "22–28 °C", "600–1000 ppm". */
export function formatClimateRange(
  variable: ClimateVariable,
  low: number,
  high: number,
): string {
  const { unit, decimals } = GAUGES[variable];
  const number = (value: number) => String(Number(value.toFixed(decimals)));
  const range = `${number(low)}–${number(high)}`;
  return unit === '%' ? `${range}%` : `${range} ${unit}`;
}

/** In-game duration: "5 d 3 h", "7 h". */
export function formatGameHours(hours: number): string {
  if (!Number.isFinite(hours)) return 'never';
  const days = Math.floor(hours / 24);
  const rest = Math.round(hours % 24);
  if (days === 0) return `${rest} h`;
  return rest === 0 ? `${days} d` : `${days} d ${rest} h`;
}

/** Real-world duration: "45 s", "2 h 15 min", "3 days 4 h". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    const minutes = totalMinutes % 60;
    return minutes === 0 ? `${totalHours} h` : `${totalHours} h ${minutes} min`;
  }
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const dayText = days === 1 ? '1 day' : `${days.toLocaleString('en-US')} days`;
  return hours === 0 ? dayText : `${dayText} ${hours} h`;
}

/** A rough real-world duration for small labels: "7 min", "1.5 h". */
export function formatShortDuration(ms: number): string {
  if (!Number.isFinite(ms)) return 'never';
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.round(minutes / 30) / 2} h`;
}

/** An estimated real-world duration: "about 2 h 15 min". */
export function formatRealDuration(ms: number): string {
  return Number.isFinite(ms) ? `about ${formatDuration(ms)}` : 'never';
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** Running costs per in-game day, from the cost per hour: "2.7", "15". */
export function formatPerDay(perHour: number): string {
  const perDay = perHour * 24;
  return perDay < 10 ? perDay.toFixed(1) : String(Math.round(perDay));
}

/** Power, from the energy used in one hour: "3.2 kW". */
export function formatKw(kwhPerHour: number): string {
  return `${kwhPerHour.toFixed(1)} kW`;
}

export function formatKwh(kwh: number): string {
  return `${kwh.toFixed(1)} kWh`;
}

/** A cost with one decimal, negative when it earned: "4.2", "−1.3". */
export function formatCost(amount: number): string {
  const tenths = Math.round(amount * 10);
  if (tenths === 0) return '0.0';
  return `${tenths < 0 ? '−' : ''}${(Math.abs(tenths) / 10).toFixed(1)}`;
}

/** An hour of the day: "07:00". */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}
