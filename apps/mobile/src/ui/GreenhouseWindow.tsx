import {
  EQUIPMENT_KINDS,
  EQUIPMENT_SETPOINTS,
  type EquipmentKind,
  type SetpointId,
  type SetpointRange,
} from '@voltiris/content';
import { serviceCost, type DeviceRun, type Greenhouse } from '@voltiris/sim';
import { useState } from 'react';
import { describeCommandError } from '../game/commandErrors';
import { useGame } from '../game/context';
import {
  formatClimate,
  formatKw,
  formatPercent,
  formatPerDay,
} from '../game/format';
import { equipmentPlan } from '../game/selectors';
import { cx } from './cx';
import styles from './Equipment.module.css';
import { deviceStatus, EQUIPMENT_INFO, SETPOINT_INFO } from './equipmentInfo';
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

  return (
    <>
      {!fitted ? (
        <p className={styles.intro}>
          Each device works on part of the climate, to the targets on the
          Climate tab. It costs energy and supplies to run.
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
          Not enough Volticoins: the equipment is off.
        </p>
      )}
      <ul className={styles.list}>
        {EQUIPMENT_KINDS.map((kind) => (
          <EquipmentRow
            key={kind}
            kind={kind}
            greenhouse={greenhouse}
            run={running ? plan.devices[kind] : undefined}
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
}: {
  kind: EquipmentKind;
  greenhouse: Greenhouse;
  run: DeviceRun | undefined;
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
              {run ? deviceStatus(kind, run.load) : 'Off'}
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
  const game = useGame((s) => s.game);
  const content = useGame((s) => s.content);
  const setSetpoint = useGame((s) => s.setSetpoint);
  const setAutoControl = useGame((s) => s.setAutoControl);
  const notify = useGame((s) => s.notify);
  const report = useReport();
  const { plan } = equipmentPlan(game, content);
  const auto = greenhouse.computer && greenhouse.auto;
  const fitted = EQUIPMENT_KINDS.filter((kind) => greenhouse.equipment[kind]);

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
      {fitted.length === 0 ? (
        <p className={styles.intro}>
          Buy equipment to control the climate: each device works to the targets
          you set here.
        </p>
      ) : (
        <ul className={styles.list}>
          {fitted.map((kind) => (
            <li key={kind} className={styles.control}>
              <span className={styles.controlName}>
                <EquipmentIcon kind={kind} size={18} />
                {EQUIPMENT_INFO[kind].name}
              </span>
              {EQUIPMENT_SETPOINTS[kind].map((id) => (
                <SetpointStepper
                  key={id}
                  id={id}
                  value={plan.setpoints[id]}
                  now={greenhouse.climate[SETPOINT_INFO[id].variable]}
                  disabled={auto}
                  onChange={(value) => {
                    const error = setSetpoint(greenhouse.id, id, value);
                    if (error) notify(describeCommandError(error), 'error');
                  }}
                />
              ))}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** The next value a step away, on the step grid and inside the range. */
function stepped(value: number, range: SetpointRange, direction: 1 | -1) {
  const next = Math.round((value + direction * range.step) / range.step);
  const snapped = Number((next * range.step).toFixed(6));
  return Math.min(range.max, Math.max(range.min, snapped));
}

function SetpointStepper({
  id,
  value,
  now,
  disabled,
  onChange,
}: {
  id: SetpointId;
  value: number;
  now: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const range = useGame((s) => s.content.control.ranges[id]);
  const { label, variable } = SETPOINT_INFO[id];
  return (
    <div role="group" aria-label={label} className={styles.stepper}>
      <span className={styles.stepLabel}>
        {label}
        <span className={styles.muted}>Now {formatClimate(variable, now)}</span>
      </span>
      <button
        type="button"
        className={styles.step}
        aria-label="Lower"
        disabled={disabled || value <= range.min}
        onClick={() => onChange(stepped(value, range, -1))}
      >
        −
      </button>
      <output className={styles.value}>{formatClimate(variable, value)}</output>
      <button
        type="button"
        className={styles.step}
        aria-label="Raise"
        disabled={disabled || value >= range.max}
        onClick={() => onChange(stepped(value, range, 1))}
      >
        +
      </button>
    </div>
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
            : 'Sets every target for the crops growing, and lets the equipment idle when nothing grows.'
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
