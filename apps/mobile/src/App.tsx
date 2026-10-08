import styles from './App.module.css';
import { GameCanvas } from './scene/GameCanvas';
import { ClimateBadges } from './ui/ClimateBadges';
import { Hud } from './ui/Hud';
import { PlotBubble } from './ui/PlotBubble';
import { Toast } from './ui/Toast';
import { Windows } from './ui/Windows';

/**
 * The map fills the screen. The buildings on it open the game modes, the HUD
 * sits at the top, the climate down the left edge.
 */
export function App({ debug = false }: { debug?: boolean }) {
  return (
    <main className={styles.stage}>
      <GameCanvas debug={debug} />
      <ClimateBadges />
      <Hud />
      <PlotBubble />
      <Windows />
      <Toast />
    </main>
  );
}
