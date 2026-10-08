import '@fontsource-variable/fredoka/wght.css';
import { defaultContent } from '@voltiris/content';
import { createGame, type GameState } from '@voltiris/sim';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createScaledClock, systemClock } from './game/clock';
import { GameStoreContext } from './game/context';
import { readDevFlags } from './game/devFlags';
import { pageLifecycle } from './game/lifecycle';
import { newUuid, randomSeed } from './game/ids';
import { ServicesContext, type AppServices } from './game/services';
import { createGameStore, startGameLoop } from './game/store';
import './index.css';
import { startAutosave } from './save/autosave';
import { exportText, saveFileName } from './save/exportText';
import { createIndexedDbSaveStore } from './save/indexedDbSaveStore';
import { loadGame } from './save/loadGame';
import { LoadFailed } from './ui/LoadFailed';

const element = document.getElementById('root');
if (!element) throw new Error('Missing #root element');
const root = createRoot(element);
const render = (node: ReactNode) =>
  root.render(<StrictMode>{node}</StrictMode>);

const flags = readDevFlags(window.location.search, import.meta.env);
const clock = createScaledClock(systemClock, flags.speed);
const content = defaultContent;
const saveStore = createIndexedDbSaveStore();

const services: AppServices = {
  newGame: () =>
    createGame({ playerId: newUuid(), seed: randomSeed() }, content, clock),
  now: () => Date.now(),
  exportText,
};

/** Runs a game: the loop, the autosave and the UI. */
function play(game: GameState, restoredFromBackup = false) {
  const store = createGameStore({ content, clock, newId: newUuid, game });
  startGameLoop(store);
  startAutosave({
    store,
    saveStore,
    now: services.now,
    onError: (error) => {
      console.error('[save]', error);
      store.getState().notify('Could not save the game', 'error');
    },
  });
  if (restoredFromBackup) {
    store
      .getState()
      .notify('Your last save was damaged, so a backup was loaded.', 'error');
  }
  if (flags.debug) {
    // Visible in `adb logcat`: checks the WebView reports going to background.
    pageLifecycle.onHide(() => console.info('[app] hidden'));
    pageLifecycle.onShow(() => console.info('[app] visible'));
  }
  render(
    <ServicesContext value={services}>
      <GameStoreContext value={store}>
        <App debug={flags.debug} />
      </GameStoreContext>
    </ServicesContext>,
  );
}

async function boot() {
  // Ask the browser not to clear our storage when space runs low.
  void navigator.storage?.persist?.().catch(() => false);
  // Pixi draws text with this font, so it must be ready before the map.
  await document.fonts.load('600 16px "Fredoka Variable"').catch(() => []);

  const loaded = await loadGame(saveStore, content);
  switch (loaded.kind) {
    case 'empty':
      play(services.newGame());
      break;
    case 'loaded':
      play(loaded.game, loaded.fromBackup);
      break;
    case 'failed':
      console.error('[save] load failed', loaded.error);
      render(
        <LoadFailed
          error={loaded.error}
          raw={loaded.raw}
          onExport={(text) => exportText(text, saveFileName(Date.now()))}
          onNewGame={() => play(services.newGame())}
        />,
      );
      break;
  }
}

void boot();
