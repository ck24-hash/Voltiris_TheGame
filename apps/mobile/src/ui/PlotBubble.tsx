import { CLIMATE_VARIABLES, CROP_IDS, type CropId } from '@voltiris/content';
import {
  cropQuality,
  growthProgress,
  growthRate,
  hoursToReady,
  type CommandError,
  type Greenhouse,
  type GrowingPlanting,
  type ReadyPlanting,
} from '@voltiris/sim';
import { useState } from 'react';
import { describeCommandError } from '../game/commandErrors';
import { useGame } from '../game/context';
import {
  formatGameHours,
  formatPercent,
  formatRealDuration,
  formatShortDuration,
} from '../game/format';
import { GAUGES, readGauge } from '../game/gauges';
import { CROP_ICONS } from '../game/selectors';
import { CLIMATE_INFO } from './climateInfo';
import { cx } from './cx';
import { GameButton } from './GameButton';
import { ClimateIcon, ClockIcon } from './icons';
import { BUBBLE_WIDTH, placeBubble } from './placeBubble';
import styles from './PlotBubble.module.css';
import { VolticoinIcon } from './VolticoinIcon';
import { WaterButton } from './WaterButton';

type ShowError = (error: CommandError | null) => void;

/** Where long crop names may break on the narrow seed cards (soft hyphens). */
const SEED_LABELS: Partial<Record<CropId, string>> = {
  microgreens: 'Micro­greens',
  cucumber: 'Cucum­ber',
  strawberry: 'Straw­berry',
};

/** Pop-up next to the tapped plot: plant it, follow its crop, harvest it. */
export function PlotBubble() {
  const selection = useGame((s) => s.selection);
  const greenhouse = useGame((s) => s.game.greenhouses[0]);

  if (!greenhouse || !selection) return null;
  const index = greenhouse.plots.findIndex((p) => p.id === selection.plotId);
  const plot = greenhouse.plots[index];
  if (!plot) return null;
  const place = placeBubble(selection.anchor, window.innerHeight);

  return (
    <div className={styles.layer}>
      <div
        role="dialog"
        aria-label={`Plot ${index + 1}`}
        className={cx(styles.bubble, styles[place.side])}
        style={{ ...place.bubble, width: BUBBLE_WIDTH }}
      >
        {/* A new plot starts without the last plot's error. */}
        <PlotContent
          key={plot.id}
          title={`Plot ${index + 1}`}
          greenhouse={greenhouse}
          plotId={plot.id}
        />
      </div>
      <div
        className={cx(styles.tail, styles[`tail-${place.side}`])}
        style={place.tail}
      />
    </div>
  );
}

function PlotContent({
  title,
  greenhouse,
  plotId,
}: {
  title: string;
  greenhouse: Greenhouse;
  plotId: string;
}) {
  const [error, setError] = useState<CommandError | null>(null);
  const planting = greenhouse.plots.find((p) => p.id === plotId)?.planting;

  return (
    <>
      {!planting && (
        <SeedPicker
          title={title}
          greenhouse={greenhouse}
          plotId={plotId}
          onError={setError}
        />
      )}
      {planting?.status === 'growing' && (
        <Growing
          title={title}
          planting={planting}
          greenhouse={greenhouse}
          onError={setError}
        />
      )}
      {planting?.status === 'ready' && (
        <Ready
          title={title}
          planting={planting}
          greenhouseId={greenhouse.id}
          plotId={plotId}
          onError={setError}
        />
      )}
      {error && (
        <p className={styles.error} role="alert">
          {describeCommandError(error)}
        </p>
      )}
    </>
  );
}

function SeedPicker({
  title,
  greenhouse,
  plotId,
  onError,
}: {
  title: string;
  greenhouse: Greenhouse;
  plotId: string;
  onError: ShowError;
}) {
  const crops = useGame((s) => s.content.crops);
  const msPerTick = useGame((s) => s.content.time.realMsPerTick);
  const money = useGame((s) => s.game.money);
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
          const rate = growthRate(greenhouse.climate, crop);
          const ticks = rate > 0 ? crop.growthHours / rate : Infinity;
          const affordable = money >= crop.seedCost;
          return (
            <li key={id}>
              <button
                type="button"
                className={styles.seed}
                aria-label={`Plant ${crop.name}`}
                disabled={!affordable}
                onClick={() => onError(plantCrop(greenhouse.id, plotId, id))}
              >
                <span className={styles.seedIcon} aria-hidden="true">
                  {CROP_ICONS[id]}
                </span>
                <strong className={styles.seedName}>
                  {SEED_LABELS[id] ?? crop.name}
                </strong>
                <span
                  className={cx(styles.seedTime, rate < 0.75 && styles.slow)}
                  title="Time to harvest in this greenhouse"
                >
                  <ClockIcon size={11} />
                  {formatShortDuration(ticks * msPerTick)}
                </span>
                <span className={styles.cost}>
                  <VolticoinIcon size={12} />
                  {crop.seedCost}
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
  greenhouse,
  onError,
}: {
  title: string;
  planting: GrowingPlanting;
  greenhouse: Greenhouse;
  onError: ShowError;
}) {
  const content = useGame((s) => s.content);
  const gameHour = useGame((s) => s.game.clock.gameHour);
  const crop = content.crops[planting.cropId];
  const { climate } = greenhouse;

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
  // Thirsty: watering right here helps.
  const thirsty = issues.some(
    ({ variable, reading }) =>
      variable === 'water' && reading.note === GAUGES.water.low,
  );

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
                <span className={styles.fix}>
                  {reading.note === GAUGES[variable].low
                    ? CLIMATE_INFO[variable].fixLow
                    : CLIMATE_INFO[variable].fixHigh}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {thirsty && (
        <div className={styles.care}>
          <WaterButton greenhouseId={greenhouse.id} onDone={onError} />
        </div>
      )}
    </>
  );
}

function Ready({
  title,
  planting,
  greenhouseId,
  plotId,
  onError,
}: {
  title: string;
  planting: ReadyPlanting;
  greenhouseId: string;
  plotId: string;
  onError: ShowError;
}) {
  const harvestCrop = useGame((s) => s.harvestCrop);
  const notify = useGame((s) => s.notify);
  const name = useGame((s) => s.content.crops[planting.cropId].name);

  const harvest = () => {
    const error = harvestCrop(greenhouseId, plotId);
    onError(error);
    if (!error) notify(`${planting.yieldUnits} × ${name} went to storage`);
  };

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
      <GameButton tone="gold" className={styles.wide} onClick={harvest}>
        Harvest
      </GameButton>
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
