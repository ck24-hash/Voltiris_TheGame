import { useGame } from '../game/context';
import type { Tab } from '../game/store';
import styles from './BottomNav.module.css';
import { cx } from './cx';

const TABS: readonly { id: Tab; label: string; icon: string }[] = [
  { id: 'greenhouse', label: 'Greenhouse', icon: '🌱' },
  { id: 'market', label: 'Market', icon: '📈' },
  { id: 'energy', label: 'Energy', icon: '⚡' },
  { id: 'village', label: 'Village', icon: '🏘️' },
];

export function BottomNav() {
  const tab = useGame((s) => s.tab);
  const setTab = useGame((s) => s.setTab);

  return (
    <nav className={styles.nav} aria-label="Main">
      {TABS.map(({ id, label, icon }) => (
        <button
          key={id}
          type="button"
          className={cx(styles.tab, tab === id && styles.active)}
          aria-current={tab === id ? 'page' : undefined}
          onClick={() => setTab(id)}
        >
          <span aria-hidden="true">{icon}</span>
          {label}
        </button>
      ))}
    </nav>
  );
}
