import { getCalendar } from '@voltiris/sim';
import { useGame } from '../game/context';
import {
  formatCoins,
  formatCoinsLong,
  formatDayTime,
  formatSeason,
} from '../game/format';
import styles from './Hud.module.css';
import { GearIcon, SeasonIcon } from './icons';
import { VolticoinIcon } from './VolticoinIcon';

/** Calendar top left; money and settings top right. */
export function Hud() {
  const money = useGame((s) => s.game.money);
  const gameHour = useGame((s) => s.game.clock.gameHour);
  const time = useGame((s) => s.content.time);
  const openWindow = useGame((s) => s.openWindow);
  const calendar = getCalendar(gameHour, time);

  return (
    <header className={styles.hud}>
      <div className={styles.calendar}>
        <span className={styles.season} data-season={calendar.season}>
          <SeasonIcon season={calendar.season} size={22} />
        </span>
        <span className={styles.lines}>
          <strong>{formatDayTime(calendar)}</strong>
          <span>{formatSeason(calendar)}</span>
        </span>
      </div>

      <div className={styles.right}>
        <div className={styles.coins} title={formatCoinsLong(money)}>
          <span className={styles.coinIcon}>
            <VolticoinIcon size={34} />
          </span>
          <span className={styles.money} aria-label={formatCoinsLong(money)}>
            {formatCoins(money)}
          </span>
        </div>
        <button
          type="button"
          className={styles.gear}
          aria-label="Settings"
          onClick={() => openWindow('settings')}
        >
          <GearIcon size={26} />
        </button>
      </div>
    </header>
  );
}
