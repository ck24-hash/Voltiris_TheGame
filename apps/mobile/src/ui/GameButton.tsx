import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';
import styles from './GameButton.module.css';

type Tone = 'green' | 'gold' | 'red' | 'blue';

/** A chunky, pressable game button. */
export function GameButton({
  tone = 'green',
  small = false,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  small?: boolean;
}) {
  return (
    <button
      type={type}
      className={cx(
        styles.button,
        styles[tone],
        small && styles.small,
        className,
      )}
      {...props}
    />
  );
}
