import { Capacitor } from '@capacitor/core';
import type { ExportMethod } from '../game/services';

/**
 * Gives exported save text to the player: a file download in a browser, the
 * clipboard in the app (an Android WebView cannot download files).
 */
export async function exportText(
  text: string,
  fileName: string,
): Promise<ExportMethod> {
  if (Capacitor.isNativePlatform()) {
    await navigator.clipboard.writeText(text);
    return 'copied';
  }
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

/** "voltiris-save-2026-10-08.json". */
export function saveFileName(now: number): string {
  return `voltiris-save-${new Date(now).toISOString().slice(0, 10)}.json`;
}
