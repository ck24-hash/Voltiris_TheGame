import {
  EQUIPMENT_SETPOINTS,
  type ClimateVariable,
  type CropDef,
  type EquipmentKind,
  type SetpointId,
  type SetpointRange,
} from '@voltiris/content';
import type { ClimatePlan, Greenhouse } from '@voltiris/sim';
import { describeCommandError } from '../game/commandErrors';
import { useGame } from '../game/context';
import { formatClimate, formatClimateRange } from '../game/format';
import { GAUGES, idealRange, readGauge, type IdealRange } from '../game/gauges';
import { equipmentPlan, growingCrops } from '../game/selectors';
import { CLIMATE_INFO } from './climateInfo';
import styles from './Condition.module.css';
import { cx } from './cx';
import { deviceStatus, EQUIPMENT_INFO, SETPOINT_INFO } from './equipmentInfo';
import { ClimateIcon, EquipmentIcon } from './icons';
import { WaterButton } from './WaterButton';

/**
 * One part of the greenhouse climate: its value and how it suits the crops
 * growing, their ideal range, and the targets of the equipment that works on
 * it. With `explain`, also why it matters and what changes it.
 */
export function Condition({
  variable,
  greenhouse,
  explain = false,
}: {
  variable: ClimateVariable;
  greenhouse: Greenhouse;
  explain?: boolean;
}) {
  const game = useGame((s) => s.game);
  const content = useGame((s) => s.content);
  const setSetpoint = useGame((s) => s.setSetpoint);
  const notify = useGame((s) => s.notify);
  const { plan, running } = equipmentPlan(game, content);
  const crops = growingCrops(greenhouse, content.crops);
  const value = greenhouse.climate[variable];
  const reading = readGauge(variable, value, crops);
  const ideal = idealRange(variable, crops);
  const info = CLIMATE_INFO[variable];
  const fitted = info.equipment.filter((kind) => greenhouse.equipment[kind]);
  const missing = info.equipment.filter((kind) => !greenhouse.equipment[kind]);
  const auto = greenhouse.computer && greenhouse.auto;
  const { label } = GAUGES[variable];
  const showError = (error: Parameters<typeof describeCommandError>[0]) =>
    notify(describeCommandError(error), 'error');

  return (
    <section className={styles.condition} aria-label={label}>
      <div className={cx(styles.head, styles[reading.status])}>
        <span className={styles.icon} data-variable={variable}>
          <ClimateIcon variable={variable} size={18} />
        </span>
        <strong className={styles.label}>{label}</strong>
        <span className={styles.value}>{formatClimate(variable, value)}</span>
        <span className={styles.status}>{reading.note}</span>
      </div>
      <p className={styles.ideal}>{describeIdeal(variable, ideal, crops)}</p>
      {explain && (
        <>
          <p className={styles.why}>{info.why}</p>
          <dl className={styles.changes}>
            <dt>Raises it</dt>
            <dd>{info.raise}</dd>
            <dt>Lowers it</dt>
            <dd>{info.lower}</dd>
          </dl>
        </>
      )}
      {fitted.map((kind) =>
        EQUIPMENT_SETPOINTS[kind].map((id) => (
          <SetpointStepper
            key={id}
            id={id}
            kind={kind}
            value={plan.setpoints[id]}
            ideal={ideal}
            status={deviceLine(kind, plan, running)}
            disabled={auto}
            onChange={(next) => {
              const error = setSetpoint(greenhouse.id, id, next);
              if (error) showError(error);
            }}
          />
        )),
      )}
      {auto && fitted.length > 0 && (
        <p className={styles.note}>The climate computer sets these targets.</p>
      )}
      {missing.length > 0 && (
        <p className={styles.note}>
          No {missing.map((kind) => EQUIPMENT_INFO[kind].name).join(' or ')}{' '}
          yet: buy {missing.length > 1 ? 'them' : 'one'} on the greenhouse’s
          Equipment tab.
        </p>
      )}
      {variable === 'water' && (
        <div className={styles.actions}>
          <WaterButton
            greenhouseId={greenhouse.id}
            onDone={(error) => {
              if (error) showError(error);
            }}
          />
        </div>
      )}
    </section>
  );
}

/** "Ideal for Cucumber: 22–28 °C", or why there is no single ideal. */
function describeIdeal(
  variable: ClimateVariable,
  ideal: IdealRange | null,
  crops: readonly CropDef[],
): string {
  if (!ideal) return 'Plant a crop to see what it likes.';
  const range = formatClimateRange(variable, ideal.low, ideal.high);
  if (!ideal.shared)
    return `Your crops disagree: ${range} is the middle ground.`;
  const [only] = crops;
  return crops.length === 1 && only
    ? `Ideal for ${only.name}: ${range}`
    : `Ideal for your crops: ${range}`;
}

/** What a device does this hour, for the line under its target. */
function deviceLine(
  kind: EquipmentKind,
  plan: ClimatePlan,
  running: boolean,
): string {
  const { name } = EQUIPMENT_INFO[kind];
  if (plan.resting) return `${name} · Resting: nothing is growing`;
  const run = plan.devices[kind];
  if (!running || !run) return `${name} · Off`;
  return `${name} · ${deviceStatus(kind, run.load)}`;
}

/** The next value a step away, on the step grid and inside the range. */
function stepped(value: number, range: SetpointRange, direction: 1 | -1) {
  const next = Math.round((value + direction * range.step) / range.step);
  const snapped = Number((next * range.step).toFixed(6));
  return Math.min(range.max, Math.max(range.min, snapped));
}

function SetpointStepper({
  id,
  kind,
  value,
  ideal,
  status,
  disabled,
  onChange,
}: {
  id: SetpointId;
  kind: EquipmentKind;
  value: number;
  ideal: IdealRange | null;
  status: string;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const range = useGame((s) => s.content.control.ranges[id]);
  const { label, variable } = SETPOINT_INFO[id];
  // A target outside the ideal range works against the crops.
  const outside =
    ideal !== null && ideal.shared && (value < ideal.low || value > ideal.high);
  return (
    <div role="group" aria-label={label} className={styles.stepper}>
      <span className={styles.stepIcon}>
        <EquipmentIcon kind={kind} size={16} />
      </span>
      <span className={styles.stepLabel}>
        {label}
        <span className={styles.muted}>{status}</span>
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
      <output
        className={cx(styles.target, outside && styles.outside)}
        title={outside ? 'Outside the ideal range' : undefined}
      >
        {formatClimate(variable, value)}
        {outside && <span className={styles.flag}>Not ideal</span>}
      </output>
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
