import type { Tab } from '../game/store';
import styles from './ComingSoon.module.css';

const SCREENS: Record<
  Exclude<Tab, 'greenhouse'>,
  { title: string; text: string }
> = {
  market: {
    title: 'Market',
    text: 'Sell your harvest at changing prices and fill customer orders.',
  },
  energy: {
    title: 'Energy',
    text: 'Power your greenhouses with the grid, solar panels, batteries and Voltiris modules.',
  },
  village: {
    title: 'Village',
    text: 'Grow from one greenhouse into a whole complex.',
  },
};

export function ComingSoon({ tab }: { tab: Exclude<Tab, 'greenhouse'> }) {
  const { title, text } = SCREENS[tab];
  return (
    <section className={styles.screen} aria-label={title}>
      <div className={styles.card}>
        <h2>{title}</h2>
        <p>{text}</p>
        <p className={styles.soon}>Coming soon</p>
      </div>
    </section>
  );
}
