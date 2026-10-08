import { defaultContent } from '@voltiris/content';
import { createGame } from '@voltiris/sim';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createScaledClock, systemClock } from './game/clock';
import { GameStoreContext } from './game/context';
import { readDevFlags } from './game/devFlags';
import { newUuid, randomSeed } from './game/ids';
import { createGameStore, startGameLoop } from './game/store';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

const flags = readDevFlags(window.location.search, import.meta.env);
const clock = createScaledClock(systemClock, flags.speed);

// No saves until Phase 4: every launch starts a new game.
const game = createGame(
  { playerId: newUuid(), seed: randomSeed() },
  defaultContent,
  clock,
);
const store = createGameStore({
  content: defaultContent,
  clock,
  newId: newUuid,
  game,
});
startGameLoop(store);

createRoot(root).render(
  <StrictMode>
    <GameStoreContext value={store}>
      <App debug={flags.debug} />
    </GameStoreContext>
  </StrictMode>,
);
