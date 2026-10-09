import type {
  EquipmentKind,
  EquipmentLevels,
  GameContent,
  GlassLevel,
} from '@voltiris/content';
import type { Equipment, Greenhouse } from './state';

export type EquipmentLevel<K extends EquipmentKind> =
  EquipmentLevels[K][number];

/** What can be bought for the greenhouse itself, besides equipment. */
export const GREENHOUSE_UPGRADES = ['glass', 'size', 'computer'] as const;

export type GreenhouseUpgrade = (typeof GREENHOUSE_UPGRADES)[number];

/** A level's content; levels count from 1. */
export function levelAt<T>(levels: readonly T[], level: number): T {
  const def = levels[level - 1];
  if (def === undefined) throw new RangeError(`No level ${level}`);
  return def;
}

export function equipmentLevel<K extends EquipmentKind>(
  kind: K,
  level: number,
  content: GameContent,
): EquipmentLevel<K> {
  const levels: readonly EquipmentLevel<K>[] = content.equipment.levels[kind];
  return levelAt(levels, level);
}

/** An installed device: its level, and the share of its output wear leaves. */
export interface Device<K extends EquipmentKind> {
  readonly level: EquipmentLevel<K>;
  readonly strength: number;
}

export function installedDevice<K extends EquipmentKind>(
  greenhouse: Greenhouse,
  kind: K,
  content: GameContent,
): Device<K> | null {
  const device = greenhouse.equipment[kind];
  if (!device) return null;
  return {
    level: equipmentLevel(kind, device.level, content),
    strength: 1 - device.wear * content.equipment.wearLoss,
  };
}

/** Whole Volticoins to service a device back to new. */
export function serviceCost(
  kind: EquipmentKind,
  device: Equipment,
  content: GameContent,
): number {
  const { price } = equipmentLevel(kind, device.level, content);
  return Math.ceil(price * content.equipment.serviceShare * device.wear);
}

export function glassOf(
  greenhouse: Greenhouse,
  content: GameContent,
): GlassLevel {
  return levelAt(content.greenhouse.glass, greenhouse.glass);
}
