import { CLIMATE_VARIABLES } from '@voltiris/content';
import { useGame } from '../game/context';
import { formatClimate } from '../game/format';
import { GAUGES, readGauge } from '../game/gauges';
import { growingCrops } from '../game/selectors';
import { cx } from './cx';
import styles from './GaugePanel.module.css';

/** Live climate of the greenhouse, judged against the crops growing in it. */
export function GaugePanel() {
  const greenhouse = useGame((s) => s.game.greenhouses[0]);
  const crops = useGame((s) => s.content.crops);
  if (!greenhouse) return null;
  const growing = growingCrops(greenhouse, crops);

  return (
    <section className={styles.panel} aria-label="Greenhouse climate">
      {CLIMATE_VARIABLES.map((variable) => {
        const value = greenhouse.climate[variable];
        const reading = readGauge(variable, value, growing);
        return (
          <div
            key={variable}
            className={cx(styles.gauge, styles[reading.status])}
            data-status={reading.status}
            role="group"
            aria-label={GAUGES[variable].label}
          >
            <div className={styles.row}>
              <span className={styles.label}>{GAUGES[variable].short}</span>
              {reading.status !== 'idle' && (
                <span className={styles.note}>{reading.note}</span>
              )}
            </div>
            <div className={styles.value}>{formatClimate(variable, value)}</div>
          </div>
        );
      })}
    </section>
  );
}
