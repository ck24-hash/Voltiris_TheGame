import type { Graphics } from 'pixi.js';
import type { Point } from '../../iso/projection';
import { COLORS } from '../palette';
import { toonCircle } from './shapes';

// Placeholder equipment shapes, standing on the floor at `p`. Equipment joins
// the sim in Phase 6; until then they only show in the debug preview.

export type EquipmentShape = 'heater' | 'fan' | 'co2Injector' | 'growLight';

export const EQUIPMENT_SHAPES: readonly EquipmentShape[] = [
  'heater',
  'fan',
  'co2Injector',
  'growLight',
];

export function drawEquipment(
  g: Graphics,
  shape: EquipmentShape,
  { x, y }: Point,
): void {
  g.ellipse(x, y + 4, 22, 8).fill({ color: COLORS.shadow, alpha: 0.15 });
  switch (shape) {
    case 'heater':
      g.roundRect(x - 18, y - 34, 36, 34, 6)
        .fill(COLORS.heater)
        .stroke({ color: COLORS.soilRim, width: 2 });
      for (const dy of [-26, -18, -10]) {
        g.moveTo(x - 11, y + dy)
          .lineTo(x + 11, y + dy)
          .stroke({ color: 0xffffff, width: 2 });
      }
      break;
    case 'fan':
      g.rect(x - 3, y - 20, 6, 20).fill(COLORS.metalDark);
      toonCircle(g, x, y - 34, 16, COLORS.metal, COLORS.metalDark);
      for (const [dx, dy] of [
        [0, -9],
        [8, 5],
        [-8, 5],
      ] as const) {
        g.ellipse(x + dx, y - 34 + dy, 5, 7).fill(COLORS.metalDark);
      }
      break;
    case 'co2Injector':
      g.roundRect(x - 10, y - 46, 20, 46, 8)
        .fill(COLORS.metal)
        .stroke({ color: COLORS.metalDark, width: 2 });
      g.rect(x - 10, y - 30, 20, 8).fill(0x42a5f5);
      g.rect(x - 3, y - 54, 6, 8).fill(COLORS.metalDark);
      break;
    case 'growLight':
      g.rect(x - 2, y - 56, 4, 56).fill(COLORS.metalDark);
      g.roundRect(x - 22, y - 62, 44, 10, 4)
        .fill(COLORS.metal)
        .stroke({ color: COLORS.metalDark, width: 2 });
      g.poly([
        x - 20,
        y - 52,
        x + 20,
        y - 52,
        x + 30,
        y - 20,
        x - 30,
        y - 20,
      ]).fill({ color: COLORS.lamp, alpha: 0.45 });
      break;
  }
}
