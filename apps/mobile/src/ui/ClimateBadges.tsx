import { CLIMATE_VARIABLES } from '@voltiris/content';
import { useGame } from '../game/context';
import { formatClimate } from '../game/format';
import { GAUGES, readGauge } from '../game/gauges';
import { growingCrops } from '../game/selectors';
import styles from './ClimateBadges.module.css';
import { cx } from './cx';
import { ClimateIcon } from './icons';

/**
 * Live greenhouse climate down the left edge. The ring shows how the value
 * suits the crops growing (judged by the worst-off one), with a short note
 * when something is off.
 */
export function ClimateBadges() {
  const greenhouse = useGame((s) => s.game.greenhouses[0]);
  const crops = useGame((s) => s.content.crops);
  if (!greenhouse) return null;
  const growing = growingCrops(greenhouse, crops);

  return (
    <section className={styles.panel} aria-label="Greenhouse climate">
      {CLIMATE_VARIABLES.map((variable) => {
        const value = greenhouse.climate[variable];
        const reading = readGauge(variable, value, growing);
        const off = reading.status === 'warn' || reading.status === 'bad';
        return (
          <div
            key={variable}
            className={cx(styles.badge, styles[reading.status])}
            data-status={reading.status}
            role="group"
            aria-label={GAUGES[variable].label}
          >
            <span className={styles.icon} data-variable={variable}>
              <ClimateIcon variable={variable} size={18} />
            </span>
            <span className={styles.text}>
              <span className={styles.value}>
                {formatClimate(variable, value)}
              </span>
              {off && <span className={styles.note}>{reading.note}</span>}
            </span>
          </div>
        );
      })}
    </section>
  );
}
