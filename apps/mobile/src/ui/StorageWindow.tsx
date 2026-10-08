import {
  freshness,
  lotQuality,
  storedUnits,
  type StoredLot,
} from '@voltiris/sim';
import { useGame } from '../game/context';
import { formatPercent, formatShortDuration } from '../game/format';
import { CROP_ICONS } from '../game/selectors';
import { GameButton } from './GameButton';
import { GameWindow } from './GameWindow';
import styles from './Produce.module.css';

/** The storage barn: what is waiting to be sold, and how fresh it still is. */
export function StorageWindow() {
  const closeWindow = useGame((s) => s.closeWindow);
  const openWindow = useGame((s) => s.openWindow);
  const storage = useGame((s) => s.game.storage);
  const capacity = useGame((s) => s.content.storage.capacity);
  const used = storedUnits(storage);

  return (
    <GameWindow title="Storage" tone="red" onClose={closeWindow}>
      <div
        className={styles.capacity}
        role="meter"
        aria-label="Storage used"
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={used}
      >
        <div
          className={styles.capacityFill}
          style={{ width: `${(used / capacity) * 100}%` }}
        />
        <span className={styles.capacityText}>
          {used} / {capacity} units
        </span>
      </div>
      {storage.lots.length === 0 ? (
        <p className={styles.intro}>
          Empty. Harvest ready crops and they come here to wait for the market.
        </p>
      ) : (
        <ul className={styles.list}>
          {storage.lots.map((lot) => (
            <LotRow key={lot.id} lot={lot} />
          ))}
        </ul>
      )}
      <div className={styles.footer}>
        <GameButton tone="gold" onClick={() => openWindow('market')}>
          Go to the market
        </GameButton>
      </div>
    </GameWindow>
  );
}

function LotRow({ lot }: { lot: StoredLot }) {
  const crop = useGame((s) => s.content.crops[lot.cropId]);
  const msPerTick = useGame((s) => s.content.time.realMsPerTick);
  const gameHour = useGame((s) => s.game.clock.gameHour);
  const fresh = freshness(lot, gameHour, crop);
  const hoursLeft = fresh * crop.shelfLifeDays * 24;

  return (
    <li className={styles.row}>
      <span className={styles.icon} aria-hidden="true">
        {CROP_ICONS[lot.cropId]}
      </span>
      <span className={styles.name}>
        <strong>
          {lot.units} × {crop.name}
        </strong>
        <span className={styles.muted}>
          Quality {formatPercent(lotQuality(lot, gameHour, crop))}
        </span>
      </span>
      <span
        className={styles.freshness}
        title="Freshness: produce sells for less as it ages"
      >
        <span className={styles.freshBar}>
          <span
            className={styles.freshFill}
            style={{ width: `${fresh * 100}%` }}
          />
        </span>
        <span className={styles.muted}>
          Fresh for {formatShortDuration(hoursLeft * msPerTick)}
        </span>
      </span>
    </li>
  );
}
