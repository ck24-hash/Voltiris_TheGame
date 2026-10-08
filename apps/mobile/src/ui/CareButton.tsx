import type { CommandError } from '@voltiris/sim';
import { useGame } from '../game/context';
import type { Care } from '../game/selectors';
import styles from './CareButton.module.css';
import { cx } from './cx';
import { GameButton } from './GameButton';
import { ClimateIcon } from './icons';
import { VolticoinIcon } from './VolticoinIcon';

const ACTIONS: Record<Care, { readonly verb: string; readonly label: string }> =
  {
    water: { verb: 'Water', label: 'Water the plants' },
    nutrients: { verb: 'Feed', label: 'Feed the plants' },
  };

/**
 * Tops up a greenhouse's water or nutrients for a few Volticoins. `compact`
 * is the round "+" beside a climate badge; otherwise a labelled button.
 */
export function CareButton({
  resource,
  greenhouseId,
  onDone,
  compact = false,
}: {
  resource: Care;
  greenhouseId: string;
  /** Called with the sim's refusal, or null when it worked. */
  onDone: (error: CommandError | null) => void;
  compact?: boolean;
}) {
  const cost = useGame((s) => s.content.care[resource].cost);
  const act = useGame((s) => (resource === 'water' ? s.water : s.fertilize));
  const { verb, label } = ACTIONS[resource];
  const onClick = () => onDone(act(greenhouseId));

  if (compact) {
    return (
      <button
        type="button"
        className={cx(styles.plus, styles[resource])}
        aria-label={`${label} (${cost} Volticoins)`}
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
      aria-label={`${label} (${cost} Volticoins)`}
      onClick={onClick}
    >
      <ClimateIcon variable={resource} size={16} />
      {verb}
      <span className={styles.cost}>
        <VolticoinIcon size={13} />
        {cost}
      </span>
    </GameButton>
  );
}
