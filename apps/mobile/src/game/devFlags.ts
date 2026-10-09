// Development switches, from the URL (?speed=60&debug) or build-time env
// (VITE_TIME_SPEED=60, VITE_DEBUG=1). Not meant for players.

export interface DevFlags {
  /** Game time multiplier; 1 is normal speed. */
  readonly speed: number;
  /** Shows the FPS meter. */
  readonly debug: boolean;
}

export function readDevFlags(
  search: string,
  env: { VITE_TIME_SPEED?: string; VITE_DEBUG?: string },
): DevFlags {
  const params = new URLSearchParams(search);
  const speed = Number(params.get('speed') ?? env.VITE_TIME_SPEED ?? 1);
  return {
    speed: Number.isFinite(speed) && speed > 0 ? speed : 1,
    debug: params.has('debug') || env.VITE_DEBUG === '1',
  };
}
