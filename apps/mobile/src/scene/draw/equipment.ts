import type { Graphics } from 'pixi.js';
import { COLORS } from '../palette';
import { toonCircle } from './shapes';

// Placeholder equipment shapes, drawn around (0, 0) on the floor. Equipment
// joins the sim in Phase 6; until then they only show in the debug preview.

export type EquipmentShape = 'heater' | 'fan' | 'co2Injector' | 'growLight';

export const EQUIPMENT_SHAPES: readonly EquipmentShape[] = [
  'heater',
  'fan',
  'co2Injector',
  'growLight',
];

export function drawEquipment(g: Graphics, shape: EquipmentShape): void {
  g.clear();
  g.ellipse(0, 4, 22, 8).fill({ color: COLORS.shadow, alpha: 0.15 });
  switch (shape) {
    case 'heater':
      g.roundRect(-18, -34, 36, 34, 6)
        .fill(COLORS.heater)
        .stroke({ color: COLORS.soilRim, width: 2 });
      for (const y of [-26, -18, -10]) {
        g.moveTo(-11, y).lineTo(11, y).stroke({ color: 0xffffff, width: 2 });
      }
      break;
    case 'fan':
      g.rect(-3, -20, 6, 20).fill(COLORS.metalDark);
      toonCircle(g, 0, -34, 16, COLORS.metal, COLORS.metalDark);
      for (const [dx, dy] of [
        [0, -9],
        [8, 5],
        [-8, 5],
      ] as const) {
        g.ellipse(dx, -34 + dy, 5, 7).fill(COLORS.metalDark);
      }
      break;
    case 'co2Injector':
      g.roundRect(-10, -46, 20, 46, 8)
        .fill(COLORS.metal)
        .stroke({ color: COLORS.metalDark, width: 2 });
      g.rect(-10, -30, 20, 8).fill(0x42a5f5);
      g.rect(-3, -54, 6, 8).fill(COLORS.metalDark);
      break;
    case 'growLight':
      g.rect(-2, -56, 4, 56).fill(COLORS.metalDark);
      g.roundRect(-22, -62, 44, 10, 4)
        .fill(COLORS.metal)
        .stroke({ color: COLORS.metalDark, width: 2 });
      g.poly([-20, -52, 20, -52, 30, -20, -30, -20]).fill({
        color: COLORS.lamp,
        alpha: 0.45,
      });
      break;
  }
}
