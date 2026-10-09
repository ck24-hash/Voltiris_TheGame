import { CROP_IDS, type CropId } from '@voltiris/content';
import { cropPrice, sell, stockOf } from '@voltiris/sim';
import { describeCommandError } from '../game/commandErrors';
import { useGame } from '../game/context';
import { formatCoins, formatPrice } from '../game/format';
import { CROP_ICONS } from '../game/selectors';
import { GameButton } from './GameButton';
import { GameWindow } from './GameWindow';
import styles from './Produce.module.css';
import { VolticoinIcon } from './VolticoinIcon';

/** The market stall: the crops' prices, and selling what is in storage. */
export function MarketWindow() {
  const closeWindow = useGame((s) => s.closeWindow);
  return (
    <GameWindow title="Market" tone="gold" onClose={closeWindow}>
      <p className={styles.intro}>
        Each crop has a fixed price for one unit at top quality. Fresh,
        high-quality produce gets the full price.
      </p>
      <ul className={styles.list}>
        {CROP_IDS.map((id) => (
          <PriceRow key={id} cropId={id} />
        ))}
      </ul>
    </GameWindow>
  );
}

function PriceRow({ cropId }: { cropId: CropId }) {
  const content = useGame((s) => s.content);
  const storage = useGame((s) => s.game.storage);
  const gameHour = useGame((s) => s.game.clock.gameHour);
  const sellCrop = useGame((s) => s.sellCrop);
  const notify = useGame((s) => s.notify);

  const crop = content.crops[cropId];
  const price = cropPrice(cropId, content);
  const stock = stockOf(storage, cropId);
  // Exactly what selling everything now would pay.
  const revenue =
    stock > 0 ? sell(storage, cropId, stock, price, gameHour, crop).revenue : 0;

  const sellAll = () => {
    const error = sellCrop(cropId, stock);
    if (error) notify(describeCommandError(error), 'error');
    else notify(`Sold ${stock} × ${crop.name} for ${formatCoins(revenue)}`);
  };

  return (
    <li className={styles.row}>
      <span className={styles.icon} aria-hidden="true">
        {CROP_ICONS[cropId]}
      </span>
      <span className={styles.name}>
        <strong>{crop.name}</strong>
        <span className={styles.muted}>
          {stock > 0 ? `${stock} in storage` : 'None in storage'}
        </span>
      </span>
      <span className={styles.price} aria-label={`${crop.name} price`}>
        <VolticoinIcon size={14} />
        {formatPrice(price)}
      </span>
      <GameButton
        small
        tone="gold"
        disabled={stock === 0}
        aria-label={`Sell ${crop.name}`}
        onClick={sellAll}
        className={styles.action}
      >
        Sell
        {stock > 0 && (
          <span className={styles.earn}>
            +<VolticoinIcon size={13} />
            {formatCoins(revenue)}
          </span>
        )}
      </GameButton>
    </li>
  );
}
