import type { Season } from '@voltiris/content';
import { getCalendar } from '@voltiris/sim';
import { useGame } from '../game/context';
import {
  formatCoins,
  formatCoinsLong,
  formatDayTime,
  formatSeason,
} from '../game/format';
import styles from './Hud.module.css';
import { VolticoinIcon } from './VolticoinIcon';

const SEASON_ICONS: Record<Season, string> = {
  spring: '🌱',
  summer: '☀️',
  autumn: '🍂',
  winter: '❄️',
};

export function Hud() {
  const money = useGame((s) => s.game.money);
  const gameHour = useGame((s) => s.game.clock.gameHour);
  const time = useGame((s) => s.content.time);
  const calendar = getCalendar(gameHour, time);

  return (
    <header className={styles.hud}>
      <div className={styles.pill} title={formatCoinsLong(money)}>
        <VolticoinIcon />
        <span className={styles.money} aria-label={formatCoinsLong(money)}>
          {formatCoins(money)}
        </span>
      </div>
      <div className={styles.pill}>{formatDayTime(calendar)}</div>
      <div className={styles.pill}>
        <span aria-hidden="true">{SEASON_ICONS[calendar.season]}</span>
        {formatSeason(calendar)}
      </div>
    </header>
  );
}
