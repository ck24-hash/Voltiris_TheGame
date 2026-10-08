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
import { cx } from './cx';
import { GameButton } from './GameButton';
import { ClimateIcon, ClockIcon } from './icons';
import { BUBBLE_WIDTH, placeBubble } from './placeBubble';
import styles from './PlotBubble.module.css';
import { VolticoinIcon } from './VolticoinIcon';

/** Pop-up next to the tapped plot: plant it, or follow its crop. */
export function PlotBubble() {
  const selection = useGame((s) => s.selection);
  const greenhouse = useGame((s) => s.game.greenhouses[0]);
  const lastError = useGame((s) => s.lastError);

  if (!greenhouse || !selection) return null;
  const index = greenhouse.plots.findIndex((p) => p.id === selection.plotId);
  const plot = greenhouse.plots[index];
  if (!plot) return null;
  const title = `Plot ${index + 1}`;
  const { planting } = plot;
  const place = placeBubble(selection.anchor);

  return (
    <div className={styles.layer}>
      <div
        role="dialog"
        aria-label={title}
        className={cx(styles.bubble, styles[place.side])}
        style={{ ...place.bubble, width: BUBBLE_WIDTH }}
      >
        {planting === null && (
          <SeedPicker title={title} greenhouse={greenhouse} plotId={plot.id} />
        )}
        {planting?.status === 'growing' && (
          <Growing
            title={title}
            planting={planting}
            climate={greenhouse.climate}
          />
        )}
        {planting?.status === 'ready' && (
          <Ready title={title} planting={planting} />
        )}
        {lastError && (
          <p className={styles.error} role="alert">
            {lastError.message}
          </p>
        )}
      </div>
      <div
        className={cx(styles.tail, styles[`tail-${place.side}`])}
        style={place.tail}
      />
    </div>
  );
}

function SeedPicker({
  title,
  greenhouse,
  plotId,
}: {
  title: string;
  greenhouse: Greenhouse;
  plotId: string;
}) {
  const crops = useGame((s) => s.content.crops);
  const plantCrop = useGame((s) => s.plantCrop);

  return (
    <>
      <header className={styles.header}>
        <strong>{title}</strong>
        <span className={styles.hint}>Pick a seed</span>
      </header>
      <ul className={styles.seeds}>
        {CROP_IDS.map((id) => {
          const crop = crops[id];
          const speed = growthRate(greenhouse.climate, crop);
          return (
            <li key={id}>
              <button
                type="button"
                className={styles.seed}
                aria-label={`Plant ${crop.name}`}
                onClick={() => plantCrop(greenhouse.id, plotId, id)}
              >
                <span className={styles.seedIcon} aria-hidden="true">
                  {CROP_ICONS[id]}
                </span>
                <strong>{crop.name}</strong>
                <span>{crop.growthDays} days</span>
                <span className={styles.price}>
                  {crop.yieldPerPlot} × <VolticoinIcon size={12} />
                  {formatPrice(crop.basePrice)}
                </span>
                <span
                  className={cx(styles.speed, speed < 0.75 && styles.slow)}
                  title="Growth speed in this greenhouse"
                >
                  {formatPercent(speed)} speed
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Growing({
  title,
  planting,
  climate,
}: {
  title: string;
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
      <CropHeader title={title} cropId={planting.cropId} status="Growing" />
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
        <span className={styles.meterText}>{formatPercent(progress)}</span>
      </div>
      <p className={styles.line}>
        <ClockIcon size={16} />
        {Number.isFinite(remaining) ? (
          <span>
            Ready in <strong>{formatGameHours(remaining)}</strong>{' '}
            <span className={styles.muted}>
              ({formatRealDuration(remaining * content.time.realMsPerTick)})
            </span>
          </span>
        ) : (
          <strong>Not growing</strong>
        )}
      </p>
      <p className={styles.line}>
        <span>
          Speed <strong>{formatPercent(rate)}</strong>
        </span>
        <span className={styles.dot}>·</span>
        <span>
          Quality <strong>{formatPercent(quality)}</strong>
        </span>
      </p>
      {issues.length === 0 ? (
        <p className={styles.perfect}>Perfect conditions!</p>
      ) : (
        <div className={styles.issues}>
          <span className={styles.issuesTitle}>Holding it back</span>
          <ul>
            {issues.map(({ variable, reading }) => (
              <li key={variable} className={styles[reading.status]}>
                <ClimateIcon variable={variable} size={14} />
                <span className={styles.issueLabel}>
                  {GAUGES[variable].short}
                </span>
                <strong>{reading.note}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function Ready({
  title,
  planting,
}: {
  title: string;
  planting: ReadyPlanting;
}) {
  return (
    <>
      <CropHeader
        title={title}
        cropId={planting.cropId}
        status="Ready!"
        ready
      />
      <p className={styles.line}>
        <span>
          Quality <strong>{formatPercent(planting.quality)}</strong>
        </span>
        <span className={styles.dot}>·</span>
        <span>
          <strong>{planting.yieldUnits}</strong> units
        </span>
      </p>
      <GameButton tone="gold" disabled className={styles.wide}>
        Harvest
      </GameButton>
      <p className={styles.muted}>Harvesting opens soon.</p>
    </>
  );
}

function CropHeader({
  title,
  cropId,
  status,
  ready = false,
}: {
  title: string;
  cropId: CropId;
  status: string;
  ready?: boolean;
}) {
  const name = useGame((s) => s.content.crops[cropId].name);
  return (
    <header className={styles.header}>
      <span className={styles.cropIcon} aria-hidden="true">
        {CROP_ICONS[cropId]}
      </span>
      <span className={styles.cropName}>
        <strong>{name}</strong>
        <span className={styles.hint}>{title}</span>
      </span>
      <span className={cx(styles.badge, ready && styles.badgeReady)}>
        {status}
      </span>
    </header>
  );
}
