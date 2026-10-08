import { useState } from 'react';
import type { ExportMethod } from '../game/services';
import type { LoadError } from '../save/loadGame';
import { describeLoadError, EXPORT_MESSAGES } from '../save/messages';
import { GameButton } from './GameButton';
import { GameWindow } from './GameWindow';
import styles from './LoadFailed.module.css';

/**
 * Shown at launch when no save could be loaded. Nothing is overwritten until
 * the player chooses: they can first export the broken save for a bug report.
 */
export function LoadFailed({
  error,
  raw,
  onExport,
  onNewGame,
}: {
  error: LoadError;
  /** The stored save as it is; undefined if storage could not be read. */
  raw: unknown;
  onExport: (text: string) => Promise<ExportMethod>;
  onNewGame: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [exported, setExported] = useState<string | null>(null);

  const exportRaw = async () => {
    try {
      const message =
        EXPORT_MESSAGES[await onExport(JSON.stringify(raw, null, 2))];
      if (message) setExported(`${message}.`);
    } catch {
      setExported('Could not export the save.');
    }
  };

  return (
    <div className={styles.screen}>
      <GameWindow title="Save problem" tone="red">
        <p>{describeLoadError(error)}</p>
        <div className={styles.row}>
          {raw !== undefined && (
            <GameButton tone="blue" onClick={() => void exportRaw()}>
              Export the save
            </GameButton>
          )}
          {confirming ? (
            <GameButton tone="red" onClick={onNewGame}>
              Yes, start over
            </GameButton>
          ) : (
            <GameButton tone="gold" onClick={() => setConfirming(true)}>
              Start a new game
            </GameButton>
          )}
        </div>
        {confirming && (
          <p className={styles.warning}>
            The saved game will be replaced. Export it first if you want to keep
            it.
          </p>
        )}
        {exported && <p className={styles.muted}>{exported}</p>}
      </GameWindow>
    </div>
  );
}
