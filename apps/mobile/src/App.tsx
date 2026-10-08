import styles from './App.module.css';
import { useGame } from './game/context';
import { GameCanvas } from './scene/GameCanvas';
import { BottomNav } from './ui/BottomNav';
import { ComingSoon } from './ui/ComingSoon';
import { GaugePanel } from './ui/GaugePanel';
import { Hud } from './ui/Hud';
import { PlantPanel } from './ui/PlantPanel';

export function App({ debug = false }: { debug?: boolean }) {
  const tab = useGame((s) => s.tab);

  return (
    <div className={styles.app}>
      <main className={styles.stage}>
        {/* The canvas stays mounted on every tab, so Pixi only starts once. */}
        <GameCanvas debug={debug} />
        {tab === 'greenhouse' ? (
          <>
            <GaugePanel />
            <PlantPanel />
          </>
        ) : (
          <ComingSoon tab={tab} />
        )}
        <Hud />
      </main>
      <BottomNav />
    </div>
  );
}
