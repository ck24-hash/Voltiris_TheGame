import { useEffect } from 'react';
import { useGame } from '../game/context';
import { cx } from './cx';
import styles from './Toast.module.css';

const SHOW_MS = 3500;

/** A short message at the top of the screen that goes away by itself. */
export function Toast() {
  const notice = useGame((s) => s.notice);
  const dismissNotice = useGame((s) => s.dismissNotice);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => dismissNotice(notice.id), SHOW_MS);
    return () => clearTimeout(id);
  }, [notice, dismissNotice]);

  if (!notice) return null;
  return (
    <div
      key={notice.id}
      role="status"
      className={cx(styles.toast, notice.tone === 'error' && styles.error)}
    >
      {notice.text}
    </div>
  );
}
