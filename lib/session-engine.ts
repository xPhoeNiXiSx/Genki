/**
 * Moteur de séance, sans horloge ni son : des fonctions pures du temps écoulé.
 *
 * L'écran ne compte pas les secondes lui-même. Il mesure le temps écoulé
 * (`SessionClock`) et demande ici où en est la séance. Un onglet mis en veille,
 * une image ratée ou un minuteur en retard ne décalent donc rien : au réveil,
 * l'état est recalculé juste.
 *
 * Même principe pour les signaux : `cuesBetween` liste ceux qui tombent entre
 * deux instants. Le lecteur les joue à chaque rafraîchissement, sans en perdre
 * ni en jouer deux fois, quel que soit l'écart entre deux rafraîchissements.
 */

export type EngineStep = { durationSeconds: number };

export type SessionState = {
  /** Étape en cours ; vaut `steps.length` une fois la séance finie. */
  index: number;
  stepElapsedMs: number;
  stepRemainingMs: number;
  /** 0 → 1, pour un anneau ou une barre. */
  stepProgress: number;
  totalMs: number;
  totalRemainingMs: number;
  finished: boolean;
};

export type Cue =
  /** Décompte vocal avant un changement d'étape : « trois, deux, un ». */
  | { atMs: number; kind: "count"; value: 1 | 2 | 3 }
  /** Début d'une étape. L'étape 0 tombe à 0 ms. */
  | { atMs: number; kind: "step"; index: number }
  | { atMs: number; kind: "end" };

/** Fin de chaque étape, en ms depuis le début de la séance. */
export function stepEnds(steps: EngineStep[]): number[] {
  let at = 0;
  return steps.map((step) => (at += step.durationSeconds * 1000));
}

export function totalMs(steps: EngineStep[]): number {
  return steps.reduce((sum, step) => sum + step.durationSeconds * 1000, 0);
}

/** Début de l'étape `index`, en ms. Sert à passer à l'étape suivante ou précédente. */
export function stepStartMs(steps: EngineStep[], index: number): number {
  const clamped = Math.max(0, Math.min(index, steps.length));
  return totalMs(steps.slice(0, clamped));
}

export function stateAt(steps: EngineStep[], elapsedMs: number): SessionState {
  const total = totalMs(steps);
  const elapsed = Math.max(0, elapsedMs);

  let start = 0;
  for (let index = 0; index < steps.length; index += 1) {
    const length = steps[index].durationSeconds * 1000;
    if (elapsed < start + length) {
      const stepElapsedMs = elapsed - start;
      return {
        index,
        stepElapsedMs,
        stepRemainingMs: length - stepElapsedMs,
        stepProgress: stepElapsedMs / length,
        totalMs: total,
        totalRemainingMs: total - elapsed,
        finished: false,
      };
    }
    start += length;
  }

  return {
    index: steps.length,
    stepElapsedMs: 0,
    stepRemainingMs: 0,
    stepProgress: 1,
    totalMs: total,
    totalRemainingMs: 0,
    finished: true,
  };
}

/** Tous les signaux d'une séance, dans l'ordre. */
export function allCues(steps: EngineStep[]): Cue[] {
  const cues: Cue[] = [];
  if (steps.length === 0) return cues;

  cues.push({ atMs: 0, kind: "step", index: 0 });

  let start = 0;
  steps.forEach((step, index) => {
    const end = start + step.durationSeconds * 1000;
    // Le décompte reste dans son étape : une étape de 2 s n'entend que
    // « deux, un », sans empiéter sur la précédente.
    for (const value of [3, 2, 1] as const) {
      const atMs = end - value * 1000;
      if (atMs > start) cues.push({ atMs, kind: "count", value });
    }
    cues.push(
      index === steps.length - 1
        ? { atMs: end, kind: "end" }
        : { atMs: end, kind: "step", index: index + 1 },
    );
    start = end;
  });

  return cues;
}

/**
 * Signaux tombant dans ]fromMs ; toMs]. Pour démarrer une séance, partir de
 * `fromMs = -1` afin d'inclure le signal de la première étape.
 *
 * Un saut en avant de plus d'une seconde (retour de veille, étape passée à la
 * main) ne rejoue pas tout ce qui a été sauté : seul le dernier signal de
 * changement d'étape est gardé, et les décomptes dépassés sont abandonnés.
 */
export function cuesBetween(steps: EngineStep[], fromMs: number, toMs: number): Cue[] {
  if (toMs <= fromMs) return [];
  const crossed = allCues(steps).filter((cue) => cue.atMs > fromMs && cue.atMs <= toMs);
  if (toMs - fromMs <= 1000) return crossed;

  const lastChange = crossed.filter((cue) => cue.kind !== "count").at(-1);
  const freshCounts = crossed.filter(
    (cue) => cue.kind === "count" && toMs - cue.atMs < 1000 && (!lastChange || cue.atMs > lastChange.atMs),
  );
  return [...(lastChange ? [lastChange] : []), ...freshCounts];
}

/* -------------------------------------------------------------------------
   Horloge de séance : temps écoulé, avec pause et reprise.
   État immuable ; `now` est fourni par l'appelant (performance.now()).
   ------------------------------------------------------------------------- */

export type SessionClock = {
  /** Temps cumulé avant le dernier départ. */
  accumulatedMs: number;
  /** Instant du dernier départ, `null` en pause. */
  runningSince: number | null;
};

export const newClock = (): SessionClock => ({ accumulatedMs: 0, runningSince: null });

export function elapsed(clock: SessionClock, now: number): number {
  return clock.accumulatedMs + (clock.runningSince === null ? 0 : now - clock.runningSince);
}

export function play(clock: SessionClock, now: number): SessionClock {
  return clock.runningSince === null ? { ...clock, runningSince: now } : clock;
}

export function pause(clock: SessionClock, now: number): SessionClock {
  return clock.runningSince === null
    ? clock
    : { accumulatedMs: elapsed(clock, now), runningSince: null };
}

/** Place l'horloge à `ms`, en conservant marche ou pause. */
export function seek(clock: SessionClock, now: number, ms: number): SessionClock {
  return { accumulatedMs: Math.max(0, ms), runningSince: clock.runningSince === null ? null : now };
}
