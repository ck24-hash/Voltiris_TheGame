import type { ReactNode } from 'react';
import { useGame } from '../game/context';
import equipment from './Equipment.module.css';
import { GameButton } from './GameButton';
import { GameWindow } from './GameWindow';
import { ClimateIcon, EquipmentIcon, PowerIcon } from './icons';
import { VolticoinIcon } from './VolticoinIcon';
import windows from './Windows.module.css';

/** How to play: opens on a new game, and from the "?" button. */
export function GuideWindow() {
  const closeWindow = useGame((s) => s.closeWindow);
  const reserve = useGame((s) => s.content.economy.reserve);

  return (
    <GameWindow title="How to play" onClose={closeWindow}>
      <ul className={equipment.list}>
        <Step icon={<span aria-hidden="true">🌱</span>} title="Plant">
          Tap a plot in the greenhouse and pick seeds. Microgreens are ready in
          2 minutes: start with them. Slower crops earn more per harvest.
        </Step>
        <Step
          icon={<ClimateIcon variable="temperature" />}
          title="Keep them happy"
        >
          The badges on the left show the greenhouse climate. Green is good;
          orange or red slows your crops. Tap a badge to see what your crops
          like and what helps. Tap + to water.
        </Step>
        <Step
          icon={<span aria-hidden="true">🧺</span>}
          title="Harvest and sell"
        >
          Tap a ready plot to harvest it into the storage barn, then sell at the
          market stall. Prices are fixed; fresh, top-quality produce earns the
          most.
        </Step>
        <Step icon={<EquipmentIcon kind="heater" />} title="Equipment">
          Tap the greenhouse to buy equipment. It works to the targets you set,
          only while crops grow, for a little energy and water.
        </Step>
        <Step icon={<PowerIcon part="grid" />} title="Electricity">
          Power is cheapest at night and dearest in the evening peak. At the
          energy shed, solar panels, a battery and a CHP unit cut the bill.
        </Step>
        <Step icon={<VolticoinIcon size={22} />} title="Money">
          Tap your coins to see what comes in and what goes out. The last{' '}
          {reserve} Volticoins are kept for seeds, so you can always plant
          again.
        </Step>
      </ul>
      <p className={equipment.intro}>
        Your greenhouse keeps growing while you are away, for up to 24 hours.
      </p>
      <div className={windows.actions}>
        <GameButton onClick={closeWindow}>Let’s grow!</GameButton>
      </div>
    </GameWindow>
  );
}

function Step({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className={equipment.row}>
      <span className={equipment.icon}>{icon}</span>
      <span className={equipment.name}>
        <strong>{title}</strong>
        <span className={equipment.muted}>{children}</span>
      </span>
    </li>
  );
}
