import type { EnergyAsset, TariffBand } from '@voltiris/content';
import {
  levelAt,
  planHour,
  tariffBand,
  type DayBooks,
  type EnergyHour,
  type HourPrices,
} from '@voltiris/sim';
import { useState, type ReactNode } from 'react';
import { useGame } from '../game/context';
import {
  formatCost,
  formatHour,
  formatKw,
  formatKwh,
  formatPrice,
} from '../game/format';
import { cx } from './cx';
import styles from './EnergyWindow.module.css';
import equipment from './Equipment.module.css';
import { ENERGY_INFO } from './equipmentInfo';
import { GameWindow } from './GameWindow';
import { PowerIcon, type PowerPart } from './icons';
import table from './Table.module.css';
import { Tabs } from './Tabs';
import { UpgradeRow } from './UpgradeRow';
import { useReport } from './useReport';
import { VolticoinIcon } from './VolticoinIcon';

const TABS = [
  { id: 'now', label: 'Now' },
  { id: 'today', label: 'Today' },
  { id: 'build', label: 'Build' },
] as const;

type Tab = (typeof TABS)[number]['id'];

/** The energy shed: where the power comes from now, what it costs, and what to build. */
export function EnergyWindow() {
  const closeWindow = useGame((s) => s.closeWindow);
  const [tab, setTab] = useState<Tab>('now');
  return (
    <GameWindow title="Energy" tone="blue" onClose={closeWindow}>
      <Tabs label="Energy" tabs={TABS} value={tab} onChange={setTab}>
        {tab === 'now' && <NowTab />}
        {tab === 'today' && <TodayTab />}
        {tab === 'build' && <BuildTab />}
      </Tabs>
    </GameWindow>
  );
}

/** A stretch of the day at one price, in hours of the day (to may pass 24). */
interface Span {
  readonly from: number;
  readonly to: number;
}

/** One tariff price, with the bands and hours of the day it applies to. */
interface PriceTier {
  readonly price: number;
  readonly names: readonly string[];
  readonly spans: readonly Span[];
}

/**
 * Groups the hours of the day by tariff price, cheapest first. A stretch
 * over midnight stays one.
 */
function priceTiers(bands: readonly TariffBand[]): PriceTier[] {
  const spans: (Span & { price: number; name: string })[] = [];
  bands.forEach(({ price, name }, hour) => {
    const last = spans[spans.length - 1];
    if (last && last.price === price) {
      spans[spans.length - 1] = { ...last, to: hour + 1 };
    } else {
      spans.push({ from: hour, to: hour + 1, price, name });
    }
  });
  const first = spans[0];
  const last = spans[spans.length - 1];
  if (spans.length > 1 && first && last && first.price === last.price) {
    spans[0] = { ...first, from: last.from, to: first.to + 24 };
    spans.pop();
  }
  const prices = [...new Set(spans.map((span) => span.price))].sort(
    (a, b) => a - b,
  );
  return prices.map((price) => {
    const mine = spans.filter((span) => span.price === price);
    return {
      price,
      names: [...new Set(mine.map((span) => span.name))],
      spans: mine,
    };
  });
}

/** Cheapest, dearest, or in between. */
function tierTone(tier: number, count: number): 'cheap' | 'normal' | 'dear' {
  if (tier === 0) return 'cheap';
  return tier === count - 1 ? 'dear' : 'normal';
}

function formatSpan({ from, to }: Span): string {
  return `${formatHour(from % 24)}–${formatHour(to % 24)}`;
}

/**
 * The day's grid prices hour by hour, with now marked, and what they are.
 * `prices` are this hour's: the season scales the whole tariff.
 */
function TariffStrip({
  gameHour,
  prices,
}: {
  gameHour: number;
  prices: HourPrices;
}) {
  const content = useGame((s) => s.content);
  const hourOfDay = gameHour % 24;
  const bands = Array.from({ length: 24 }, (_, hour) =>
    tariffBand(hour, content),
  );
  const season = prices.buy / tariffBand(hourOfDay, content).price;
  const tiers = priceTiers(bands);
  const toneOf = (price: number) =>
    tierTone(
      tiers.findIndex((tier) => tier.price === price),
      tiers.length,
    );

  return (
    <figure className={styles.strip}>
      <div className={styles.bar} aria-hidden="true">
        {bands.map(({ price }, hour) => (
          <span key={hour} className={styles[toneOf(price)]} />
        ))}
        <span
          className={styles.now}
          style={{ left: `${((hourOfDay + 0.5) / 24) * 100}%` }}
        />
      </div>
      <div className={styles.ticks} aria-hidden="true">
        {[0, 6, 12, 18, 24].map((hour) => (
          <span key={hour}>{formatHour(hour % 24)}</span>
        ))}
      </div>
      <figcaption>
        <ul className={styles.legend} aria-label="Grid prices">
          {tiers.map((tier, k) => (
            <li key={tier.price}>
              <span
                className={cx(styles.swatch, styles[tierTone(k, tiers.length)])}
              />
              <span>
                <strong>{tier.names.join(', ')}</strong>{' '}
                {tier.spans.map(formatSpan).join(', ')}
              </span>
              <span className={styles.legendPrice}>
                <VolticoinIcon size={12} />
                {formatPrice(tier.price * season)}
              </span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

function NowTab() {
  const game = useGame((s) => s.game);
  const content = useGame((s) => s.content);
  const hour = planHour(game, content);
  const flows = hour.energy;
  const { prices } = flows;
  const resting = hour.plans.every((plan) => plan.resting);

  return (
    <>
      <p className={styles.tariff}>
        <span>
          Grid power now <VolticoinIcon size={14} />
          <strong>{formatPrice(prices.buy)}</strong> a kWh · {prices.band}
        </span>
        <span className={equipment.muted}>
          Spare power sells for half: {formatPrice(prices.sell)}
        </span>
      </p>
      <TariffStrip gameHour={game.clock.gameHour} prices={prices} />
      <p className={equipment.intro}>
        Your greenhouse uses your own power first (solar panels, CHP), then the
        battery, then the grid. The battery keeps cheap power for the dear
        hours.
      </p>
      <ul className={equipment.list} aria-label="Power this hour">
        <Flow
          part="greenhouse"
          name="Greenhouse"
          value={formatKw(flows.demand)}
        >
          {resting
            ? 'Resting: nothing is growing'
            : hour.running
              ? 'Lamps, heat pumps, fans and pumps'
              : 'Equipment off: Volticoins kept for seeds'}
        </Flow>
        <Flow
          part="solar"
          name="Solar panels"
          value={game.energy.solar > 0 ? formatKw(flows.solar) : null}
        >
          {game.energy.solar === 0
            ? 'None built yet'
            : flows.solar > 0
              ? 'Making power'
              : 'No sun now'}
        </Flow>
        <Flow
          part="chp"
          name="CHP unit"
          value={flows.chp > 0 ? formatKw(flows.chp) : null}
        >
          {game.energy.chp === 0
            ? 'None built yet'
            : flows.chp > 0
              ? `Running: ${formatKw(flows.chpHeat)} of heat for the greenhouse`
              : 'Idle: not worth running now'}
        </Flow>
        <BatteryFlow flows={flows} />
        <Flow
          part="grid"
          name="Grid"
          value={
            flows.bought > 0
              ? formatKw(flows.bought)
              : flows.sold > 0
                ? formatKw(flows.sold)
                : null
          }
        >
          {flows.bought > 0
            ? 'Buying'
            : flows.sold > 0
              ? 'Selling spare power'
              : 'Nothing bought or sold'}
        </Flow>
      </ul>
      <p className={styles.hourCost}>
        This hour’s energy {flows.total < 0 ? 'earns' : 'costs'}{' '}
        <VolticoinIcon size={14} />
        <strong>{formatCost(Math.abs(flows.total))}</strong>
      </p>
    </>
  );
}

function Flow({
  part,
  name,
  value,
  children,
}: {
  part: PowerPart;
  name: string;
  /** Power this hour; null when there is none. */
  value: string | null;
  children: ReactNode;
}) {
  return (
    <li className={equipment.row} role="group" aria-label={name}>
      <span className={cx(equipment.icon, value !== null && styles.live)}>
        <PowerIcon part={part} size={22} />
      </span>
      <span className={equipment.name}>
        <strong>{name}</strong>
        <span className={equipment.muted}>{children}</span>
      </span>
      {value !== null && <span className={styles.value}>{value}</span>}
    </li>
  );
}

function BatteryFlow({ flows }: { flows: EnergyHour }) {
  const content = useGame((s) => s.content);
  const level = useGame((s) => s.game.energy.battery);
  // The charge now; the flows say where it is heading this hour.
  const stored = useGame((s) => s.game.energy.stored);
  if (level === 0) {
    return (
      <Flow part="battery" name="Battery" value={null}>
        None built yet
      </Flow>
    );
  }
  const { capacity } = levelAt(content.energy.battery, level);
  const charging = flows.charged > 0;
  const supplying = flows.discharged > 0;
  return (
    <Flow
      part="battery"
      name="Battery"
      value={
        charging
          ? formatKw(flows.charged)
          : supplying
            ? formatKw(flows.discharged)
            : null
      }
    >
      <span className={styles.battery}>
        {charging ? 'Charging' : supplying ? 'Supplying' : 'Waiting'} ·{' '}
        {formatKwh(stored)} of {capacity}
        <span
          className={styles.meter}
          role="meter"
          aria-label="Battery charge"
          aria-valuemin={0}
          aria-valuemax={capacity}
          aria-valuenow={Math.round(stored)}
        >
          <span
            className={styles.meterFill}
            style={{ width: `${(stored / capacity) * 100}%` }}
          />
        </span>
      </span>
    </Flow>
  );
}

const KWH_ROWS: readonly {
  label: string;
  kwh: (day: DayBooks) => number;
}[] = [
  { label: 'Solar made', kwh: (d) => d.solarKwh },
  { label: 'CHP made', kwh: (d) => d.chpKwh },
  { label: 'Bought from the grid', kwh: (d) => d.boughtKwh },
  { label: 'Sold to the grid', kwh: (d) => d.soldKwh },
];

function TodayTab() {
  const { today, yesterday } = useGame((s) => s.game.books);

  return (
    <>
      <table className={table.table}>
        <thead>
          <tr>
            <th scope="col">Power</th>
            <th scope="col">Today</th>
            <th scope="col">Yesterday</th>
          </tr>
        </thead>
        <tbody>
          {KWH_ROWS.map(({ label, kwh }) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{formatKwh(kwh(today))}</td>
              <td>{yesterday ? formatKwh(kwh(yesterday)) : '–'}</td>
            </tr>
          ))}
          <tr className={table.total}>
            <th scope="row">Paid for power</th>
            <td>{formatCost(today.power)}</td>
            <td>{yesterday ? formatCost(yesterday.power) : '–'}</td>
          </tr>
          <tr className={cx(table.total, table.gain)}>
            <th scope="row">Earned selling power</th>
            <td>{formatCost(today.powerSold)}</td>
            <td>{yesterday ? formatCost(yesterday.powerSold) : '–'}</td>
          </tr>
        </tbody>
      </table>
      <p className={equipment.intro}>
        Gas, CO₂ and all your other costs: tap your coins at the top.
      </p>
    </>
  );
}

function BuildTab() {
  const content = useGame((s) => s.content);
  const energy = useGame((s) => s.game.energy);
  const buyEnergy = useGame((s) => s.buyEnergy);
  const report = useReport();

  const describe: Record<EnergyAsset, (level: number) => string> = {
    solar: (level) =>
      `${levelAt(content.energy.solar, level).peak} kW at midday`,
    battery: (level) => {
      const { capacity, rate } = levelAt(content.energy.battery, level);
      return `holds ${capacity} kWh, ${rate} kW in or out`;
    },
    chp: (level) => {
      const { power, heat, fuel } = levelAt(content.energy.chp, level);
      return `${power} kW of power and ${heat} kW of heat, on ${fuel}`;
    },
  };
  const row = (asset: EnergyAsset, part: PowerPart) => {
    const { name, does } = ENERGY_INFO[asset];
    const level = energy[asset];
    const levels = content.energy[asset];
    const next = levels[level];
    const current = level > 0 ? levels[level - 1] : undefined;
    return (
      <UpgradeRow
        key={asset}
        icon={<PowerIcon part={part} size={22} />}
        name={name}
        fitted={level > 0}
        now={current ? `${current.name}: ${describe[asset](level)}` : does}
        next={
          next && {
            name: next.name,
            detail: describe[asset](level + 1),
            price: next.price,
          }
        }
        buyLabel={level > 0 ? 'Upgrade' : 'Build'}
        onBuy={() => report(buyEnergy(asset), `${next?.name ?? name} built`)}
      />
    );
  };

  return (
    <ul className={equipment.list}>
      {row('solar', 'solar')}
      {row('battery', 'battery')}
      {row('chp', 'chp')}
    </ul>
  );
}
