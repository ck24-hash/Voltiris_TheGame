import type { EnergyAsset, GameContent } from '@voltiris/content';
import {
  dayTotal,
  levelAt,
  planHour,
  tariffBand,
  type EnergyDay,
  type EnergyHour,
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
import { Tabs } from './Tabs';
import { UpgradeRow } from './UpgradeRow';
import { useReport } from './useReport';
import { VolticoinIcon } from './VolticoinIcon';

const TABS = [
  { id: 'now', label: 'Now' },
  { id: 'costs', label: 'Costs' },
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
        {tab === 'costs' && <CostsTab />}
        {tab === 'build' && <BuildTab />}
      </Tabs>
    </GameWindow>
  );
}

/** When the price next changes, after `gameHour`. */
function nextBand(gameHour: number, content: GameContent) {
  const now = tariffBand(gameHour % 24, content);
  for (let ahead = 1; ahead < 24; ahead++) {
    const hour = (gameHour + ahead) % 24;
    const band = tariffBand(hour, content);
    if (band.price !== now.price) return { name: band.name, hour };
  }
  return null;
}

function NowTab() {
  const game = useGame((s) => s.game);
  const content = useGame((s) => s.content);
  const hour = planHour(game, content);
  const flows = hour.energy;
  const { prices } = flows;
  const next = nextBand(game.clock.gameHour, content);

  return (
    <>
      <p className={styles.tariff}>
        <span>
          Grid power <VolticoinIcon size={14} />
          <strong>{formatPrice(prices.buy)}</strong> a kWh · {prices.band}
        </span>
        <span className={equipment.muted}>
          Spare power sells for {formatPrice(prices.sell)}
          {next && ` · ${next.name} from ${formatHour(next.hour)}`}
        </span>
      </p>
      <ul className={equipment.list} aria-label="Power this hour">
        <Flow
          part="greenhouse"
          name="Greenhouse"
          value={formatKw(flows.demand)}
        >
          {hour.running
            ? 'Lamps, heat pumps, fans and pumps'
            : 'Equipment off: not enough Volticoins'}
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

const COST_ROWS: readonly { key: keyof EnergyDay; label: string }[] = [
  { key: 'power', label: 'Power from the grid' },
  { key: 'heating', label: 'Heating gas' },
  { key: 'co2', label: 'CO₂' },
  { key: 'chpFuel', label: 'CHP fuel' },
];

const KWH_ROWS: readonly { key: keyof EnergyDay; label: string }[] = [
  { key: 'solar', label: 'Solar made' },
  { key: 'chp', label: 'CHP made' },
  { key: 'bought', label: 'Bought' },
  { key: 'sold', label: 'Sold' },
];

function CostsTab() {
  const { today, yesterday } = useGame((s) => s.game.energy);
  const column =
    (day: EnergyDay | null, format: (n: number) => string) =>
    (key: keyof EnergyDay) => (day ? format(day[key]) : '–');

  return (
    <>
      <p className={equipment.intro}>
        What the greenhouse’s energy cost today, since midnight, and yesterday.
        A minus means selling earned more than buying cost.
      </p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Volticoins</th>
            <th scope="col">Today</th>
            <th scope="col">Yesterday</th>
          </tr>
        </thead>
        <tbody>
          {COST_ROWS.map(({ key, label }) => (
            <tr key={key}>
              <th scope="row">{label}</th>
              <td>{column(today, formatCost)(key)}</td>
              <td>{column(yesterday, formatCost)(key)}</td>
            </tr>
          ))}
          <tr className={styles.total}>
            <th scope="row">Total</th>
            <td>{formatCost(dayTotal(today))}</td>
            <td>{yesterday ? formatCost(dayTotal(yesterday)) : '–'}</td>
          </tr>
        </tbody>
      </table>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Power</th>
            <th scope="col">Today</th>
            <th scope="col">Yesterday</th>
          </tr>
        </thead>
        <tbody>
          {KWH_ROWS.map(({ key, label }) => (
            <tr key={key}>
              <th scope="row">{label}</th>
              <td>{column(today, formatKwh)(key)}</td>
              <td>{column(yesterday, formatKwh)(key)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
