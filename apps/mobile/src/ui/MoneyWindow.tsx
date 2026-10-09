import {
  income,
  planHour,
  profit,
  spending,
  type DayBooks,
  type HourPlan,
} from '@voltiris/sim';
import { useGame } from '../game/context';
import { formatCost, formatPerDay } from '../game/format';
import { cx } from './cx';
import equipment from './Equipment.module.css';
import { GameWindow } from './GameWindow';
import table from './Table.module.css';
import { VolticoinIcon } from './VolticoinIcon';

interface Line {
  readonly label: string;
  readonly amount: (day: DayBooks) => number;
}

const MONEY_IN: readonly Line[] = [
  { label: 'Crops sold', amount: (d) => d.sales },
  { label: 'Spare power sold', amount: (d) => d.powerSold },
];

const MONEY_OUT: readonly Line[] = [
  { label: 'Seeds', amount: (d) => d.seeds },
  { label: 'Water', amount: (d) => d.water },
  { label: 'Power from the grid', amount: (d) => d.power },
  { label: 'Gas', amount: (d) => d.fuel },
  { label: 'CO₂', amount: (d) => d.co2 },
  { label: 'Equipment and building', amount: (d) => d.purchases },
];

/** Opened from the coins: what the greenhouse costs to run, and the day's books. */
export function MoneyWindow() {
  const closeWindow = useGame((s) => s.closeWindow);
  const game = useGame((s) => s.game);
  const content = useGame((s) => s.content);
  const hour = planHour(game, content);
  const { today, yesterday } = game.books;

  return (
    <GameWindow
      title="Money"
      tone="gold"
      icon={<VolticoinIcon size={26} />}
      onClose={closeWindow}
    >
      <RightNow hour={hour} reserve={content.economy.reserve} />
      <table className={table.table} aria-label="Today and yesterday">
        <thead>
          <tr>
            <th scope="col">Volticoins</th>
            <th scope="col">Today</th>
            <th scope="col">Yesterday</th>
          </tr>
        </thead>
        <tbody>
          <BookLines
            title="Money in"
            lines={MONEY_IN}
            today={today}
            yesterday={yesterday}
          />
          <TotalLine
            label="Total in"
            amount={income}
            today={today}
            yesterday={yesterday}
          />
          <BookLines
            title="Money out"
            lines={MONEY_OUT}
            today={today}
            yesterday={yesterday}
          />
          <TotalLine
            label="Total out"
            amount={spending}
            today={today}
            yesterday={yesterday}
          />
          <TotalLine
            label="Profit"
            amount={profit}
            today={today}
            yesterday={yesterday}
            signed
          />
        </tbody>
      </table>
      <p className={equipment.intro}>
        A game day lasts 6 minutes; a new one starts at midnight.
      </p>
    </GameWindow>
  );
}

/** What running the greenhouse costs now, a day at this hour’s prices. */
function RightNow({ hour, reserve }: { hour: HourPlan; reserve: number }) {
  if (hour.plans.every((plan) => plan.resting)) {
    return (
      <p className={equipment.summary}>
        Nothing is growing, so the equipment rests and costs nothing.
      </p>
    );
  }
  if (!hour.running) {
    return (
      <p className={cx(equipment.summary, equipment.warning)} role="alert">
        The equipment is off: the last {reserve} Volticoins are kept for seeds.
        Sell a harvest to switch it back on.
      </p>
    );
  }
  const { costs } = hour.energy;
  const water = hour.plans.reduce((sum, plan) => sum + plan.waterCost, 0);
  const parts = [
    { label: 'Power', amount: costs.power },
    { label: 'Gas', amount: costs.heating + costs.chpFuel },
    { label: 'CO₂', amount: costs.co2 },
    { label: 'Water', amount: water },
    { label: 'Power sold', amount: -costs.powerSold },
  ].filter((part) => part.amount !== 0);

  return (
    <div className={equipment.summary}>
      <span>
        Running the greenhouse {hour.cost < 0 ? 'earns' : 'costs'}{' '}
        <VolticoinIcon size={14} />
        <strong>{formatPerDay(Math.abs(hour.cost))}</strong> a day
      </span>
      {parts.length > 0 && (
        <span className={equipment.muted}>
          {parts
            .map(
              ({ label, amount }) =>
                `${label} ${amount < 0 ? '−' : ''}${formatPerDay(Math.abs(amount))}`,
            )
            .join(' · ')}
        </span>
      )}
    </div>
  );
}

function BookLines({
  title,
  lines,
  today,
  yesterday,
}: {
  title: string;
  lines: readonly Line[];
  today: DayBooks;
  yesterday: DayBooks | null;
}) {
  return (
    <>
      <tr className={table.group}>
        <th scope="rowgroup" colSpan={3}>
          {title}
        </th>
      </tr>
      {lines.map(({ label, amount }) => (
        <tr key={label}>
          <th scope="row">{label}</th>
          <td>{formatCost(amount(today))}</td>
          <td>{yesterday ? formatCost(amount(yesterday)) : '–'}</td>
        </tr>
      ))}
    </>
  );
}

function TotalLine({
  label,
  amount,
  today,
  yesterday,
  signed = false,
}: {
  label: string;
  amount: (day: DayBooks) => number;
  today: DayBooks;
  yesterday: DayBooks | null;
  /** Green when it is a gain, red when a loss. */
  signed?: boolean;
}) {
  const tone = signed && (amount(today) < 0 ? table.loss : table.gain);
  return (
    <tr className={cx(table.total, tone)}>
      <th scope="row">{label}</th>
      <td>{formatCost(amount(today))}</td>
      <td>{yesterday ? formatCost(amount(yesterday)) : '–'}</td>
    </tr>
  );
}
