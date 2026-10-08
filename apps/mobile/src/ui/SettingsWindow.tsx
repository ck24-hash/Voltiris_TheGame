import { SIM_VERSION, STATE_VERSION, type GameState } from '@voltiris/sim';
import { useState } from 'react';
import { useGame, useGameStore } from '../game/context';
import { useServices } from '../game/services';
import { saveFileName } from '../save/exportText';
import { describeLoadError } from '../save/messages';
import { readSaveText, saveFileToText, toSaveFile } from '../save/saveFile';
import { GameButton } from './GameButton';
import { GameWindow } from './GameWindow';
import { GearIcon, OpenIcon, RestartIcon, SaveIcon } from './icons';
import styles from './SettingsWindow.module.css';

type Panel = 'none' | 'import' | 'restart';

/** Settings: for now, the save tools (export, import, new game). */
export function SettingsWindow() {
  const closeWindow = useGame((s) => s.closeWindow);
  const [panel, setPanel] = useState<Panel>('none');
  const toggle = (next: Panel) => setPanel(panel === next ? 'none' : next);

  return (
    <GameWindow
      title="Settings"
      icon={<GearIcon size={22} />}
      tone="blue"
      onClose={closeWindow}
    >
      <h3 className={styles.heading}>Game save</h3>
      <p className={styles.muted}>
        Your game saves itself every 30 seconds, after every action and when you
        leave.
      </p>
      <div className={styles.row}>
        <ExportButton />
        <GameButton tone="blue" small onClick={() => toggle('import')}>
          <OpenIcon size={18} /> Import save
        </GameButton>
        <GameButton tone="red" small onClick={() => toggle('restart')}>
          <RestartIcon size={18} /> New game
        </GameButton>
      </div>
      {panel === 'import' && <ImportPanel onCancel={() => setPanel('none')} />}
      {panel === 'restart' && (
        <RestartPanel onCancel={() => setPanel('none')} />
      )}
      <p className={styles.version}>
        Version {SIM_VERSION} · save format {STATE_VERSION}
      </p>
    </GameWindow>
  );
}

function ExportButton() {
  const store = useGameStore();
  const { now, exportText } = useServices();

  const exportSave = async () => {
    const { game, notify } = store.getState();
    const text = saveFileToText(toSaveFile(game, now()));
    try {
      const method = await exportText(text, saveFileName(now()));
      notify(
        method === 'copied'
          ? 'Save copied to the clipboard'
          : 'Save file downloaded',
      );
    } catch {
      notify('Could not export the save', 'error');
    }
  };

  return (
    <GameButton tone="blue" small onClick={() => void exportSave()}>
      <SaveIcon size={18} /> Export save
    </GameButton>
  );
}

function ImportPanel({ onCancel }: { onCancel: () => void }) {
  const content = useGame((s) => s.content);
  const replaceGame = useGame((s) => s.replaceGame);
  const notify = useGame((s) => s.notify);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<GameState | null>(null);

  const check = () => {
    const result = readSaveText(text, content);
    setError(result.ok ? null : describeLoadError(result.error));
    setChecked(result.ok ? result.state : null);
  };

  return (
    <section className={styles.panel} aria-label="Import a save">
      <textarea
        className={styles.text}
        aria-label="Save to import"
        placeholder="Paste a save here, or choose a file"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setChecked(null);
        }}
      />
      <div className={styles.row}>
        <label className={styles.file}>
          Choose a file
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void file.text().then((value) => {
                setText(value);
                setChecked(null);
              });
            }}
          />
        </label>
        {checked ? (
          <GameButton
            tone="red"
            small
            onClick={() => {
              replaceGame(checked);
              notify('Save imported');
            }}
          >
            Replace my game
          </GameButton>
        ) : (
          <GameButton small onClick={check} disabled={text.trim() === ''}>
            Check save
          </GameButton>
        )}
        <GameButton tone="gold" small onClick={onCancel}>
          Cancel
        </GameButton>
      </div>
      {checked && (
        <p className={styles.warning}>
          This save is fine. Loading it replaces your current game.
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function RestartPanel({ onCancel }: { onCancel: () => void }) {
  const replaceGame = useGame((s) => s.replaceGame);
  const notify = useGame((s) => s.notify);
  const { newGame } = useServices();

  return (
    <section className={styles.panel} aria-label="Start a new game">
      <p className={styles.warning}>
        Start over from day 1? Your current game will be lost.
      </p>
      <div className={styles.row}>
        <GameButton tone="gold" small onClick={onCancel}>
          Keep playing
        </GameButton>
        <GameButton
          tone="red"
          small
          onClick={() => {
            replaceGame(newGame());
            notify('New game started');
          }}
        >
          Start over
        </GameButton>
      </div>
    </section>
  );
}
