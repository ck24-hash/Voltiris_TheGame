import { useEffect, useRef, type ReactNode } from 'react';
import { cx } from './cx';
import styles from './GameWindow.module.css';

/**
 * A framed game window over the map, with a title banner. With `onClose`, it
 * also closes from its round button, a tap on the backdrop or Escape.
 */
export function GameWindow({
  title,
  icon,
  tone = 'green',
  onClose,
  children,
}: {
  title: string;
  icon?: ReactNode;
  tone?: 'green' | 'gold' | 'blue' | 'red';
  onClose?: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // A tap on a building opens its window as the finger lifts; the click that
  // follows lands on this backdrop. Only a press that started here closes it.
  const pressedBackdrop = useRef(false);

  return (
    <div
      className={styles.backdrop}
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) {
          onClose?.();
        }
        pressedBackdrop.current = false;
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(styles.window, styles[tone])}
      >
        <header className={styles.banner}>
          {icon && <span className={styles.icon}>{icon}</span>}
          <h2>{title}</h2>
        </header>
        {onClose && (
          <button
            type="button"
            className={styles.close}
            aria-label="Close"
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
        <div className={styles.body}>{children}</div>
      </section>
    </div>
  );
}
