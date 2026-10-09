import {
  CLIMATE_VARIABLES,
  EQUIPMENT_KINDS,
  type EquipmentKind,
} from '@voltiris/content';
import { serviceCost, type DeviceRun, type Greenhouse } from '@voltiris/sim';
import { useState } from 'react';
import { useGame } from '../game/context';
import { formatKw, formatPercent, formatPerDay } from '../game/format';
import { equipmentPlan } from '../game/selectors';
import { Condition } from './Condition';
import { cx } from './cx';
import styles from './Equipment.module.css';
import { deviceStatus, EQUIPMENT_INFO } from './equipmentInfo';
import { GameButton } from './GameButton';
import { GameWindow } from './GameWindow';
import { ComputerIcon, EquipmentIcon, GlassIcon, SizeIcon } from './icons';
import { Price } from './Price';
import { Tabs } from './Tabs';
import { UpgradeRow } from './UpgradeRow';
import { useReport } from './useReport';
import { VolticoinIcon } from './VolticoinIcon';

const TABS = [
  { id: 'equipment', label: 'Equipment' },
  { id: 'climate', label: 'Climate' },
  { id: 'upgrades', label: 'Upgrades' },
] as const;

type Tab = (typeof TABS)[number]['id'];

/** Wear worth a service: below it, the button would only clutter the row. */
const SERVICE_FROM = 0.05;

/**
 * The greenhouse: buy and upgrade equipment, set the climate targets it
 * works to, and upgrade the greenhouse itself.
 */
export function GreenhouseWindow() {
  const closeWindow = useGame((s) => s.closeWindow);
  const greenhouse = useGame((s) => s.game.greenhouses[0]);
  const [tab, setTab] = useState<Tab>('equipment');
  if (!greenhouse) return null;

  return (
    <GameWindow title="Greenhouse" onClose={closeWindow}>
      <Tabs label="Greenhouse" tabs={TABS} value={tab} onChange={setTab}>
        {tab === 'equipment' && <EquipmentTab greenhouse={greenhouse} />}
        {tab === 'climate' && <ClimateTab greenhouse={greenhouse} />}
        {tab === 'upgrades' && <UpgradesTab greenhouse={greenhouse} />}
      </Tabs>
    </GameWindow>
  );
}

function EquipmentTab({ greenhouse }: { greenhouse: Greenhouse }) {
  const game = useGame((s) => s.game);
  const content = useGame((s) => s.content);
  const { plan, running } = equipmentPlan(game, content);
  const fitted = EQUIPMENT_KINDS.some((kind) => greenhouse.equipment[kind]);
  const { reserve } = content.economy;

  return (
    <>
      {!fitted ? (
        <p className={styles.intro}>
          Each device works on part of the climate, to the targets on the
          Climate tab. It runs only while crops grow, and costs a little energy
          and water.
        </p>
      ) : plan.resting ? (
        <p className={styles.summary}>
          Resting: nothing is growing, so the equipment is off and costs
          nothing.
        </p>
      ) : running ? (
        <p className={styles.summary}>
          <span>
            Running costs <VolticoinIcon size={14} />
            <strong>{formatPerDay(plan.cost)}</strong> a day
          </span>
          <span className={styles.muted}>
            Gas {formatKw(plan.gas)} · Power {formatKw(plan.power)}
          </span>
        </p>
      ) : (
        <p className={cx(styles.summary, styles.warning)} role="alert">
          The equipment is off: the last {reserve} Volticoins are kept for
          seeds.
        </p>
      )}
      <ul className={styles.list}>
        {EQUIPMENT_KINDS.map((kind) => (
          <EquipmentRow
            key={kind}
            kind={kind}
            greenhouse={greenhouse}
            run={running ? plan.devices[kind] : undefined}
            resting={plan.resting}
          />
        ))}
      </ul>
    </>
  );
}

function EquipmentRow({
  kind,
  greenhouse,
  run,
  resting,
}: {
  kind: EquipmentKind;
  greenhouse: Greenhouse;
  run: DeviceRun | undefined;
  resting: boolean;
}) {
  const content = useGame((s) => s.content);
  const money = useGame((s) => s.game.money);
  const buyEquipment = useGame((s) => s.buyEquipment);
  const serviceEquipment = useGame((s) => s.serviceEquipment);
  const report = useReport();

  const { name, does } = EQUIPMENT_INFO[kind];
  const levels = content.equipment.levels[kind];
  const device = greenhouse.equipment[kind];
  const current = device ? levels[device.level - 1] : undefined;
  const next = levels[device?.level ?? 0];
  const service =
    device && device.wear >= SERVICE_FROM
      ? serviceCost(kind, device, content)
      : 0;

  return (
    <li className={styles.row}>
      <span className={cx(styles.icon, device && styles.fitted)}>
        <EquipmentIcon kind={kind} size={22} />
      </span>
      <span className={styles.name}>
        <strong>{name}</strong>
        {device && current ? (
          <>
            <span className={styles.muted}>
              {current.name} · Level {device.level} of {levels.length}
            </span>
            <span className={styles.status}>
              {run ? deviceStatus(kind, run.load) : resting ? 'Resting' : 'Off'}
              {run && run.cost > 0 && (
                <>
                  {' · '}
                  <VolticoinIcon size={12} />
                  {formatPerDay(run.cost)} a day
                </>
              )}
              {device.wear >= 0.01 && ` · Wear ${formatPercent(device.wear)}`}
            </span>
          </>
        ) : (
          <span className={styles.muted}>{does}</span>
        )}
      </span>
      <span className={styles.actions}>
        {next ? (
          <>
            <GameButton
              small
              tone="gold"
              disabled={money < next.price}
              aria-label={`${device ? 'Upgrade' : 'Buy'} ${name}: ${next.name} (${next.price} Volticoins)`}
              onClick={() =>
                report(
                  buyEquipment(greenhouse.id, kind),
                  `${next.name} installed`,
                )
              }
            >
              {device ? 'Upgrade' : 'Buy'}
              <Price amount={next.price} />
            </GameButton>
            {device && <span className={styles.next}>{next.name}</span>}
          </>
        ) : (
          <span className={styles.top}>Top level</span>
        )}
        {service > 0 && (
          <GameButton
            small
            tone="blue"
            aria-label={`Service ${name} (${service} Volticoins)`}
            onClick={() =>
              report(
                serviceEquipment(greenhouse.id, kind),
                `${name} serviced: as good as new`,
              )
            }
          >
            Service
            <Price amount={service} />
          </GameButton>
        )}
      </span>
    </li>
  );
}

function ClimateTab({ greenhouse }: { greenhouse: Greenhouse }) {
  const setAutoControl = useGame((s) => s.setAutoControl);
  const report = useReport();
  const auto = greenhouse.computer && greenhouse.auto;

  return (
    <>
      {greenhouse.computer && (
        <div className={styles.computer}>
          <span className={cx(styles.icon, styles.fitted)}>
            <ComputerIcon size={22} />
          </span>
          <span className={styles.name}>
            <strong>Climate computer</strong>
            <span className={styles.muted}>
              {auto
                ? 'Sets every target for the crops growing now.'
                : 'You set the targets.'}
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={auto}
            aria-label="Automatic control"
            className={cx(styles.switch, auto && styles.on)}
            onClick={() =>
              report(
                setAutoControl(greenhouse.id, !auto),
                auto
                  ? 'Manual control: you set the targets'
                  : 'The climate computer is in charge',
              )
            }
          >
            <span className={styles.knob} />
            {auto ? 'Auto' : 'Manual'}
          </button>
        </div>
      )}
      <p className={styles.intro}>
        Keep each part of the climate in the ideal range for your crops. Each
        piece of equipment works to the targets you set.
      </p>
      {CLIMATE_VARIABLES.map((variable) => (
        <Condition key={variable} variable={variable} greenhouse={greenhouse} />
      ))}
    </>
  );
}

function UpgradesTab({ greenhouse }: { greenhouse: Greenhouse }) {
  const content = useGame((s) => s.content);
  const upgradeGreenhouse = useGame((s) => s.upgradeGreenhouse);
  const report = useReport();
  const { glass, sizes, climateComputer } = content.greenhouse;
  const firstGlass = glass[0];
  const describeGlass = (level: (typeof glass)[number]) =>
    `${formatPercent(level.transmission)} light · keeps heat ${
      firstGlass ? (firstGlass.heatLoss / level.heatLoss).toFixed(1) : '1.0'
    }×`;
  const glassNow = glass[greenhouse.glass - 1];
  const glassNext = glass[greenhouse.glass];
  const sizeNow = sizes[greenhouse.size - 1];
  const sizeNext = sizes[greenhouse.size];

  return (
    <ul className={styles.list}>
      <UpgradeRow
        icon={<GlassIcon size={22} />}
        name="Glass"
        now={glassNow ? `${glassNow.name}: ${describeGlass(glassNow)}` : ''}
        next={
          glassNext && {
            name: glassNext.name,
            detail: describeGlass(glassNext),
            price: glassNext.price,
          }
        }
        onBuy={() =>
          report(
            upgradeGreenhouse(greenhouse.id, 'glass'),
            `${glassNext?.name ?? 'New glass'} fitted`,
          )
        }
      />
      <UpgradeRow
        icon={<SizeIcon size={22} />}
        name="Size"
        now={sizeNow ? `${sizeNow.name}: ${sizeNow.plots} plots` : ''}
        next={
          sizeNext && {
            name: sizeNext.name,
            detail: `${sizeNext.plots} plots`,
            price: sizeNext.price,
          }
        }
        onBuy={() =>
          report(
            upgradeGreenhouse(greenhouse.id, 'size'),
            `The greenhouse now has ${sizeNext?.plots ?? 0} plots`,
          )
        }
      />
      <UpgradeRow
        icon={<ComputerIcon size={22} />}
        name="Climate computer"
        now={
          greenhouse.computer
            ? 'Installed: switch it between auto and manual on the Climate tab.'
            : 'Sets every target for the crops growing, so you do not have to.'
        }
        next={
          greenhouse.computer
            ? undefined
            : {
                name: 'Climate computer',
                detail: '',
                price: climateComputer.price,
              }
        }
        buyLabel="Buy"
        doneLabel="Installed"
        onBuy={() =>
          report(
            upgradeGreenhouse(greenhouse.id, 'computer'),
            'Climate computer installed: it now runs the equipment',
          )
        }
      />
    </ul>
  );
}
