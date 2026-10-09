import type { ClimateVariable } from '@voltiris/content';
import { useGame } from '../game/context';
import { GAUGES } from '../game/gauges';
import { Condition } from './Condition';
import { GameWindow } from './GameWindow';

/** Opened from a climate badge: what it is, what the crops want, what changes it. */
export function ClimateWindow({ variable }: { variable: ClimateVariable }) {
  const closeWindow = useGame((s) => s.closeWindow);
  const greenhouse = useGame((s) => s.game.greenhouses[0]);
  if (!greenhouse) return null;
  return (
    <GameWindow title={GAUGES[variable].label} onClose={closeWindow}>
      <Condition variable={variable} greenhouse={greenhouse} explain />
    </GameWindow>
  );
}
