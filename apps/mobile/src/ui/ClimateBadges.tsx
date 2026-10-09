import { CLIMATE_VARIABLES } from '@voltiris/content';
import { describeCommandError } from '../game/commandErrors';
import { useGame } from '../game/context';
import { formatClimate } from '../game/format';
import { GAUGES, readGauge } from '../game/gauges';
import { growingCrops } from '../game/selectors';
import styles from './ClimateBadges.module.css';
import { cx } from './cx';
import { ClimateIcon } from './icons';
import { WaterButton } from './WaterButton';

/**
 * Live greenhouse climate down the left edge. The ring shows how the value
 * suits the crops growing (judged by the worst-off one), with a short note
 * when something is off. Tapping a badge explains it; water has a "+" to
 * water by hand.
 */
export function ClimateBadges() {
  const greenhouse = useGame((s) => s.game.greenhouses[0]);
  const crops = useGame((s) => s.content.crops);
  const notify = useGame((s) => s.notify);
  const openWindow = useGame((s) => s.openWindow);
  if (!greenhouse) return null;
  const growing = growingCrops(greenhouse, crops);

  return (
    <section className={styles.panel} aria-label="Greenhouse climate">
      {CLIMATE_VARIABLES.map((variable) => {
        const value = greenhouse.climate[variable];
        const reading = readGauge(variable, value, growing);
        const off = reading.status === 'warn' || reading.status === 'bad';
        return (
          <div key={variable} className={styles.row}>
            <button
              type="button"
              className={cx(styles.badge, styles[reading.status])}
              data-status={reading.status}
              aria-label={`${GAUGES[variable].label}: ${formatClimate(variable, value)}, ${reading.note}`}
              onClick={() => openWindow(variable)}
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
            </button>
            {variable === 'water' && (
              <WaterButton
                compact
                greenhouseId={greenhouse.id}
                onDone={(error) => {
                  if (error) notify(describeCommandError(error), 'error');
                }}
              />
            )}
          </div>
        );
      })}
    </section>
  );
}
