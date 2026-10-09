import styles from './Equipment.module.css';
import { VolticoinIcon } from './VolticoinIcon';

/** A price on a buy button: coin and amount. */
export function Price({ amount }: { amount: number }) {
  return (
    <span className={styles.price}>
      <VolticoinIcon size={13} />
      {amount}
    </span>
  );
}
