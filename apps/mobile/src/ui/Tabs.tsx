import type { ReactNode } from 'react';
import { cx } from './cx';
import styles from './Tabs.module.css';

/** A row of tabs over the panel of the one selected. */
export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  children,
}: {
  label: string;
  tabs: readonly { readonly id: T; readonly label: string }[];
  value: T;
  onChange: (tab: T) => void;
  children: ReactNode;
}) {
  return (
    <>
      <div role="tablist" aria-label={label} className={styles.tabs}>
        {tabs.map(({ id, label: name }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={value === id}
            className={cx(styles.tab, value === id && styles.selected)}
            onClick={() => onChange(id)}
          >
            {name}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        aria-label={tabs.find((t) => t.id === value)?.label}
        className={styles.panel}
      >
        {children}
      </div>
    </>
  );
}
