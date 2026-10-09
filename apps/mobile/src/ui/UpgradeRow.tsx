import type { ReactNode } from 'react';
import { useGame } from '../game/context';
import { cx } from './cx';
import styles from './Equipment.module.css';
import { GameButton } from './GameButton';
import { Price } from './Price';

/** Something to buy level by level: what there is now, and the next level. */
export function UpgradeRow({
  icon,
  name,
  now,
  next,
  buyLabel = 'Upgrade',
  doneLabel = 'Top level',
  fitted = true,
  onBuy,
}: {
  icon: ReactNode;
  name: string;
  now: string;
  next:
    | { readonly name: string; readonly detail: string; readonly price: number }
    | undefined;
  buyLabel?: string;
  /** Shown instead of the button when there is nothing left to buy. */
  doneLabel?: string;
  /** Something is already there (the icon shows it). */
  fitted?: boolean;
  onBuy: () => void;
}) {
  const money = useGame((s) => s.game.money);
  return (
    <li className={styles.row}>
      <span className={cx(styles.icon, fitted && styles.fitted)}>{icon}</span>
      <span className={styles.name}>
        <strong>{name}</strong>
        <span className={styles.muted}>{now}</span>
        {next?.detail && (
          <span className={styles.status}>
            Next: {next.name}, {next.detail}
          </span>
        )}
      </span>
      <span className={styles.actions}>
        {next ? (
          <GameButton
            small
            tone="gold"
            disabled={money < next.price}
            aria-label={`${buyLabel} ${name}${next.name === name ? '' : `: ${next.name}`} (${next.price} Volticoins)`}
            onClick={onBuy}
          >
            {buyLabel}
            <Price amount={next.price} />
          </GameButton>
        ) : (
          <span className={styles.top}>{doneLabel}</span>
        )}
      </span>
    </li>
  );
}
