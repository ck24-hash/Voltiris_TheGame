import type { CatchUpReport } from '@voltiris/sim';
import { useGame } from '../game/context';
import {
  formatCoins,
  formatDuration,
  formatGameHours,
  formatPercent,
} from '../game/format';
import { CROP_ICONS } from '../game/selectors';
import { BUILDING_INFO } from './buildingInfo';
import { GameButton } from './GameButton';
import { GameWindow } from './GameWindow';
import { ConeIcon } from './icons';
import { MarketWindow } from './MarketWindow';
import { SettingsWindow } from './SettingsWindow';
import { StorageWindow } from './StorageWindow';
import styles from './Windows.module.css';

/** The window on top of the map, if any. The welcome back summary comes first. */
export function Windows() {
  const window = useGame((s) => s.window);
  const away = useGame((s) => s.away);
  if (away) return <AwayWindow report={away} />;
  switch (window) {
    case null:
      return null;
    case 'settings':
      return <SettingsWindow />;
    case 'market':
      return <MarketWindow />;
    case 'storage':
      return <StorageWindow />;
    default:
      return <BuildingWindow id={window} />;
  }
}

const BUILDING_TONES = {
  energy: 'blue',
  village: 'green',
} as const;

/** A building whose game mode opens in a later phase. */
function BuildingWindow({ id }: { id: keyof typeof BUILDING_TONES }) {
  const closeWindow = useGame((s) => s.closeWindow);
  const info = BUILDING_INFO[id];
  return (
    <GameWindow
      title={info.title}
      tone={BUILDING_TONES[id]}
      onClose={closeWindow}
    >
      <div className={styles.construction}>
        <ConeIcon size={46} />
        <div>
          <strong>{info.building}</strong>
          <span>Under construction</span>
        </div>
      </div>
      <p>{info.text}</p>
      <p className={styles.soon}>Opens in a later update</p>
    </GameWindow>
  );
}

function AwayWindow({ report }: { report: CatchUpReport }) {
  const dismissAway = useGame((s) => s.dismissAway);
  const plots = useGame((s) => s.game.greenhouses[0]?.plots);
  const crops = useGame((s) => s.content.crops);

  return (
    <GameWindow title="Welcome back!" tone="gold">
      <p className={styles.lead}>
        You were away for <strong>{formatDuration(report.awayMs)}</strong>. Your
        greenhouse grew for <strong>{formatGameHours(report.ticks)}</strong> of
        game time.
      </p>
      {report.cropsReady.length > 0 ? (
        <section className={styles.section}>
          <h3>Ready to harvest</h3>
          <ul className={styles.ready}>
            {report.cropsReady.map((crop) => {
              const plot = (plots ?? []).findIndex((p) => p.id === crop.plotId);
              return (
                <li key={`${crop.plotId}-${crop.readyAtHour}`}>
                  <span className={styles.cropIcon} aria-hidden="true">
                    {CROP_ICONS[crop.cropId]}
                  </span>
                  <strong>{crops[crop.cropId].name}</strong>
                  <span>Plot {plot + 1}</span>
                  <span className={styles.quality}>
                    {formatPercent(crop.quality)} quality
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p>All quiet: your crops kept growing.</p>
      )}
      {report.spoiled.length > 0 && (
        <section className={styles.section}>
          <h3>Spoiled in storage</h3>
          <ul className={styles.ready}>
            {report.spoiled.map((lot, k) => (
              <li key={k}>
                <span className={styles.cropIcon} aria-hidden="true">
                  {CROP_ICONS[lot.cropId]}
                </span>
                <strong>
                  {lot.units} × {crops[lot.cropId].name}
                </strong>
              </li>
            ))}
          </ul>
          <p className={styles.note}>
            Sell your harvest before you leave: it keeps better on the plant.
          </p>
        </section>
      )}
      {report.moneyChange !== 0 && (
        <p>
          Money: <strong>{formatCoins(report.moneyChange)}</strong>
        </p>
      )}
      {report.skippedMs > 0 && (
        <p className={styles.note}>
          Your greenhouse keeps going for up to 24 hours while you are away.
        </p>
      )}
      <div className={styles.actions}>
        <GameButton onClick={dismissAway}>Let’s go!</GameButton>
      </div>
    </GameWindow>
  );
}
