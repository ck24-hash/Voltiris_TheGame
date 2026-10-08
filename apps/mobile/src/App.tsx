import { SIM_VERSION } from '@voltiris/sim';
import styles from './App.module.css';

export function App() {
  return (
    <main className={styles.screen}>
      <h1 className={styles.title}>Voltiris: The Game</h1>
      <p className={styles.version}>Simulation engine v{SIM_VERSION}</p>
    </main>
  );
}
