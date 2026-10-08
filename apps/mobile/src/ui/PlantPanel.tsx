import {
  CLIMATE_VARIABLES,
  CROP_IDS,
  type Climate,
  type CropId,
} from '@voltiris/content';
import {
  cropQuality,
  growthProgress,
  growthRate,
  hoursToReady,
  type Greenhouse,
  type GrowingPlanting,
  type ReadyPlanting,
} from '@voltiris/sim';
import { useGame } from '../game/context';
import {
  formatGameHours,
  formatPercent,
  formatPrice,
  formatRealDuration,
} from '../game/format';
import { GAUGES, readGauge } from '../game/gauges';
import { CROP_ICONS } from '../game/selectors';
import styles from './PlantPanel.module.css';
import { VolticoinIcon } from './VolticoinIcon';

/** Side panel for the selected plot: plant, follow growth, see what is wrong. */
export function PlantPanel() {
  const selectedPlotId = useGame((s) => s.selectedPlotId);
  const greenhouse = useGame((s) => s.game.greenhouses[0]);
  const selectPlot = useGame((s) => s.selectPlot);
  const lastError = useGame((s) => s.lastError);

  if (!greenhouse || !selectedPlotId) return null;
  const index = greenhouse.plots.findIndex((p) => p.id === selectedPlotId);
  const plot = greenhouse.plots[index];
  if (!plot) return null;
  const title = `Plot ${index + 1}`;
  const { planting } = plot;

  return (
    <aside className={styles.panel} aria-label={title}>
      <header className={styles.header}>
        <h2>{title}</h2>
        <button
          type="button"
          className={styles.close}
          aria-label="Close"
          onClick={() => selectPlot(null)}
        >
          ✕
        </button>
      </header>
      {planting === null && (
        <CropChooser greenhouse={greenhouse} plotId={plot.id} />
      )}
      {planting?.status === 'growing' && (
        <GrowingDetails planting={planting} climate={greenhouse.climate} />
      )}
      {planting?.status === 'ready' && <ReadyDetails planting={planting} />}
      {lastError && (
        <p className={styles.error} role="alert">
          {lastError.message}
        </p>
      )}
    </aside>
  );
}

function CropChooser({
  greenhouse,
  plotId,
}: {
  greenhouse: Greenhouse;
  plotId: string;
}) {
  const crops = useGame((s) => s.content.crops);
  const plantCrop = useGame((s) => s.plantCrop);

  return (
    <>
      <p className={styles.hint}>Choose a crop to plant</p>
      <ul className={styles.cropList}>
        {CROP_IDS.map((id) => {
          const crop = crops[id];
          return (
            <li key={id} className={styles.cropCard}>
              <span className={styles.cropIcon} aria-hidden="true">
                {CROP_ICONS[id]}
              </span>
              <div className={styles.cropInfo}>
                <strong>{crop.name}</strong>
                <span>
                  {crop.growthDays} days · {crop.yieldPerPlot} units ·{' '}
                  <VolticoinIcon size={12} /> {formatPrice(crop.basePrice)}
                </span>
                <span className={styles.muted}>
                  Grows at {formatPercent(growthRate(greenhouse.climate, crop))}{' '}
                  speed here
                </span>
              </div>
              <button
                type="button"
                className={styles.primary}
                aria-label={`Plant ${crop.name}`}
                onClick={() => plantCrop(greenhouse.id, plotId, id)}
              >
                Plant
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function GrowingDetails({
  planting,
  climate,
}: {
  planting: GrowingPlanting;
  climate: Climate;
}) {
  const content = useGame((s) => s.content);
  const gameHour = useGame((s) => s.game.clock.gameHour);
  const crop = content.crops[planting.cropId];

  const progress = growthProgress(planting, crop);
  const rate = growthRate(climate, crop);
  const remaining = hoursToReady(planting, climate, crop);
  const quality = cropQuality(
    planting.stress,
    gameHour - planting.plantedAtHour,
    content.growth,
  );
  const issues = CLIMATE_VARIABLES.map((variable) => ({
    variable,
    reading: readGauge(variable, climate[variable], [crop]),
  })).filter(({ reading }) => reading.status !== 'good');

  return (
    <>
      <CropTitle cropId={planting.cropId} status="Growing" />
      <div
        className={styles.meter}
        role="progressbar"
        aria-label="Growth"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div
          className={styles.meterFill}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <dl className={styles.stats}>
        <dt>Ready in</dt>
        <dd>
          {Number.isFinite(remaining) ? (
            <>
              {formatGameHours(remaining)}{' '}
              <span className={styles.muted}>
                ({formatRealDuration(remaining * content.time.realMsPerTick)})
              </span>
            </>
          ) : (
            'Not growing'
          )}
        </dd>
        <dt>Growth speed</dt>
        <dd>{formatPercent(rate)}</dd>
        <dt>Quality so far</dt>
        <dd>{formatPercent(quality)}</dd>
      </dl>
      {issues.length === 0 ? (
        <p className={styles.good}>Perfect conditions</p>
      ) : (
        <>
          <h3 className={styles.subheading}>Holding it back</h3>
          <ul className={styles.issues}>
            {issues.map(({ variable, reading }) => (
              <li key={variable}>
                {GAUGES[variable].label}: <strong>{reading.note}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function ReadyDetails({ planting }: { planting: ReadyPlanting }) {
  return (
    <>
      <CropTitle cropId={planting.cropId} status="Ready!" />
      <dl className={styles.stats}>
        <dt>Quality</dt>
        <dd>{formatPercent(planting.quality)}</dd>
        <dt>Harvest</dt>
        <dd>{planting.yieldUnits} units</dd>
      </dl>
      <button type="button" className={styles.primary} disabled>
        Harvest
      </button>
      <p className={styles.muted}>Harvesting opens soon.</p>
    </>
  );
}

function CropTitle({ cropId, status }: { cropId: CropId; status: string }) {
  const name = useGame((s) => s.content.crops[cropId].name);
  return (
    <div className={styles.cropTitle}>
      <span className={styles.cropIcon} aria-hidden="true">
        {CROP_ICONS[cropId]}
      </span>
      <strong>{name}</strong>
      <span className={styles.badge}>{status}</span>
    </div>
  );
}
