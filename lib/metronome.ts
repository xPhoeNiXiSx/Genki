/**
 * Calculs du métronome. La lecture elle-même vit dans `lib/audio.ts`.
 */

export const MIN_BPM = 40;
export const MAX_BPM = 240;
/** Cadence de course de référence. */
export const DEFAULT_BPM = 180;

export function clampBpm(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(value)));
}

/** Écart entre deux battements, en secondes. */
export function beatInterval(bpm: number): number {
  return 60 / clampBpm(bpm);
}

/**
 * Battements à programmer d'avance : ceux qui tombent avant `horizon`, à
 * partir de `nextBeat`. Programmer quelques dixièmes de seconde à l'avance
 * sur l'horloge audio, plutôt que jouer chaque clic depuis un minuteur,
 * garde la cadence exacte même quand la page est occupée.
 */
export function beatsUntil(
  nextBeat: number,
  horizon: number,
  bpm: number,
): { times: number[]; nextBeat: number } {
  const step = beatInterval(bpm);
  const times: number[] = [];
  let at = nextBeat;
  while (at < horizon) {
    times.push(at);
    at += step;
  }
  return { times, nextBeat: at };
}
