import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { ExportMethod } from '../game/services';

/**
 * Gives exported save text to the player: a file download in a browser, the
 * share sheet in the app (save to Files, send by mail or chat, AirDrop...).
 */
export async function exportText(
  text: string,
  fileName: string,
): Promise<ExportMethod> {
  if (Capacitor.isNativePlatform()) return shareFile(text, fileName);
  const url = URL.createObjectURL(
    new Blob([text], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

async function shareFile(
  text: string,
  fileName: string,
): Promise<ExportMethod> {
  const { uri } = await Filesystem.writeFile({
    path: fileName,
    data: text,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  try {
    await Share.share({ title: 'Voltiris save', files: [uri] });
    return 'shared';
  } catch (error) {
    // Closing the share sheet is not a failure.
    if (String(error).toLowerCase().includes('cancel')) return 'cancelled';
    throw error;
  }
}

/** "voltiris-save-2026-10-08.json". */
export function saveFileName(now: number): string {
  return `voltiris-save-${new Date(now).toISOString().slice(0, 10)}.json`;
}
