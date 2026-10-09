import type { CommandError } from '@voltiris/sim';
import { useGame } from '../game/context';
import { cx } from './cx';
import { GameButton } from './GameButton';
import { ClimateIcon } from './icons';
import { VolticoinIcon } from './VolticoinIcon';
import styles from './WaterButton.module.css';

const LABEL = 'Water the plants';

/**
 * Waters a greenhouse by hand for a few Volticoins. `compact` is the round
 * "+" beside the water badge; otherwise a labelled button.
 */
export function WaterButton({
  greenhouseId,
  onDone,
  compact = false,
}: {
  greenhouseId: string;
  /** Called with the sim's refusal, or null when it worked. */
  onDone: (error: CommandError | null) => void;
  compact?: boolean;
}) {
  const cost = useGame((s) => s.content.care.water.cost);
  const water = useGame((s) => s.water);
  const onClick = () => onDone(water(greenhouseId));

  if (compact) {
    return (
      <button
        type="button"
        className={cx(styles.plus, styles.water)}
        aria-label={`${LABEL} (${cost} Volticoins)`}
        onClick={onClick}
      >
        +
      </button>
    );
  }
  return (
    <GameButton
      tone="blue"
      small
      aria-label={`${LABEL} (${cost} Volticoins)`}
      onClick={onClick}
    >
      <ClimateIcon variable="water" size={16} />
      Water
      <span className={styles.cost}>
        <VolticoinIcon size={13} />
        {cost}
      </span>
    </GameButton>
  );
}
