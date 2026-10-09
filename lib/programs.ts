import { query } from "@/lib/db";
import { MAX_STEP_SECONDS } from "@/lib/duration";
import { normalizeMuscles, type MuscleKey } from "@/lib/muscles";

/**
 * Une étape est soit un exercice de la bibliothèque, soit un temps de repos,
 * soit un échauffement. Le libellé nomme le repos ou l'échauffement ; pour un
 * exercice, il le précise (« jambe gauche »), ou garde son nom si l'exercice
 * a été supprimé de la bibliothèque.
 */
export const STEP_KINDS = ["exercise", "rest", "warmup"] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export const STEP_KIND_LABELS: Record<StepKind, string> = {
  exercise: "Exercice",
  rest: "Récup",
  warmup: "Échauffement",
};

/** Sons possibles au changement d'étape. */
export const SOUNDS = [
  { key: "gong", label: "Gong" },
  { key: "bip", label: "Bip" },
  { key: "cloche", label: "Cloche" },
] as const;
export type SoundKey = (typeof SOUNDS)[number]["key"];

export const MAX_ROUNDS = 20;
export const MAX_REPS = 500;
/** Durée estimée d'une répétition, pour les totaux. */
export const REP_SECONDS = 3;
export const MAX_PREP_SECONDS = 60;

export type StepInput = {
  kind: StepKind;
  exerciseId: string | null;
  label: string | null;
  /** Pour une étape en répétitions, durée estimée. */
  durationSeconds: number;
  /** Nombre de répétitions ; `null` pour une étape chronométrée. */
  reps: number | null;
  /** Numéro de boucle, partagé par des étapes consécutives. */
  loopGroup: number | null;
  /** Tours de la boucle, identique sur toutes ses étapes. */
  loopRounds: number;
};

export type ProgramInput = {
  name: string;
  category: string | null;
  notes: string | null;
  prepSeconds: number;
  sound: SoundKey;
  steps: StepInput[];
};

/** Une étape prête pour l'affichage et la séance : nom et muscles. */
export type Step = StepInput & {
  name: string;
  muscles: MuscleKey[];
};

export type Program = Omit<ProgramInput, "steps"> & {
  id: string;
  steps: Step[];
};

export type ProgramSummary = {
  id: string;
  name: string;
  category: string | null;
  stepCount: number;
  /** Durée totale, boucles comprises. */
  totalSeconds: number;
  lastDoneAt: Date | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isSound(value: unknown): value is SoundKey {
  return SOUNDS.some((s) => s.key === value);
}

function isKind(value: unknown): value is StepKind {
  return STEP_KINDS.includes(value as StepKind);
}

type Loopable = { durationSeconds: number; loopGroup: number | null; loopRounds: number };

/** Durée totale, en secondes, boucles comprises. */
export function totalSeconds(steps: Loopable[]): number {
  return steps.reduce((sum, step) => sum + step.durationSeconds * (step.loopGroup === null ? 1 : step.loopRounds), 0);
}

/**
 * Découpe les étapes en blocs : une étape seule, ou une boucle d'étapes
 * consécutives de même numéro.
 */
export function stepBlocks<T extends Loopable>(steps: T[]): { loop: { group: number; rounds: number } | null; steps: T[] }[] {
  const blocks: { loop: { group: number; rounds: number } | null; steps: T[] }[] = [];
  for (const step of steps) {
    const last = blocks.at(-1);
    if (step.loopGroup !== null && last?.loop?.group === step.loopGroup) last.steps.push(step);
    else blocks.push({ loop: step.loopGroup === null ? null : { group: step.loopGroup, rounds: step.loopRounds }, steps: [step] });
  }
  return blocks;
}

/**
 * Lit le programme envoyé par l'éditeur, en JSON. Renvoie l'erreur à
 * afficher, le cas échéant, en nommant l'étape fautive.
 */
export function parseProgramPayload(raw: unknown): { input: ProgramInput } | { error: string } {
  let data: unknown;
  try {
    data = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return { error: "La séance envoyée est illisible." };
  }
  if (!data || typeof data !== "object") return { error: "La séance envoyée est illisible." };
  const d = data as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const name = text(d.name).slice(0, 120);
  if (!name) return { error: "Donne un nom à la séance." };

  const prepSeconds = Number(d.prepSeconds ?? 10);
  if (!Number.isInteger(prepSeconds) || prepSeconds < 0 || prepSeconds > MAX_PREP_SECONDS) {
    return { error: `Le temps de préparation va de 0 à ${MAX_PREP_SECONDS} secondes.` };
  }
  const sound = d.sound ?? "gong";
  if (!isSound(sound)) return { error: "Son de transition inconnu." };

  if (!Array.isArray(d.steps) || d.steps.length === 0) return { error: "Ajoute au moins une étape." };

  const steps: StepInput[] = [];
  for (const [i, rawStep] of d.steps.entries()) {
    const position = `Étape ${i + 1}`;
    const step = (rawStep ?? {}) as Record<string, unknown>;
    if (!isKind(step.kind)) return { error: `${position} : type d'étape inconnu.` };
    const exerciseId = step.exerciseId ? text(step.exerciseId) : null;
    if (exerciseId && !UUID.test(exerciseId)) return { error: `${position} : exercice inconnu.` };
    const label = text(step.label).slice(0, 120) || null;
    if (step.kind === "exercise" && !exerciseId && !label) {
      return { error: `${position} : choisis un exercice.` };
    }
    const reps = step.kind === "exercise" && step.reps != null ? Number(step.reps) : null;
    if (reps !== null && (!Number.isInteger(reps) || reps <= 0 || reps > MAX_REPS)) {
      return { error: `${position} : de 1 à ${MAX_REPS} répétitions.` };
    }
    const durationSeconds = reps !== null ? reps * REP_SECONDS : Number(step.durationSeconds);
    if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) {
      return { error: `${position} : durée invalide.` };
    }
    if (durationSeconds > MAX_STEP_SECONDS) return { error: `${position} : une étape ne dépasse pas 3 heures.` };

    const loopGroup = step.loopGroup == null ? null : Number(step.loopGroup);
    if (loopGroup !== null && (!Number.isInteger(loopGroup) || loopGroup < 1 || loopGroup > 1000)) {
      return { error: `${position} : boucle invalide.` };
    }
    const loopRounds = loopGroup === null ? 1 : Number(step.loopRounds);
    if (!Number.isInteger(loopRounds) || loopRounds < 1 || loopRounds > MAX_ROUNDS) {
      return { error: `${position} : une boucle se répète de 1 à ${MAX_ROUNDS} fois.` };
    }

    steps.push({
      kind: step.kind,
      exerciseId: step.kind === "exercise" ? exerciseId : null,
      label: step.kind === "exercise" ? label : null,
      durationSeconds,
      reps,
      loopGroup,
      loopRounds,
    });
  }

  // Une boucle est faite d'étapes consécutives, avec un seul nombre de tours.
  const seen = new Map<number, number>();
  for (const [i, step] of steps.entries()) {
    if (step.loopGroup === null) continue;
    const before = seen.get(step.loopGroup);
    if (before !== undefined && (steps[i - 1]?.loopGroup !== step.loopGroup || before !== step.loopRounds)) {
      return { error: "Une boucle doit regrouper des étapes qui se suivent." };
    }
    seen.set(step.loopGroup, step.loopRounds);
  }

  return {
    input: {
      name,
      category: text(d.category).slice(0, 40) || null,
      notes: text(d.notes) || null,
      prepSeconds,
      sound,
      steps,
    },
  };
}

/**
 * Remplace toutes les étapes d'un programme, en une seule instruction : le
 * pilote HTTP de Neon n'offre pas de transaction entre deux requêtes, et un
 * échec entre l'effacement et la réécriture laisserait un programme vide.
 */
async function writeSteps(programId: string, steps: StepInput[]): Promise<void> {
  await query(
    `with gone as (delete from program_steps where program_id = $1)
     insert into program_steps (program_id, position, kind, exercise_id, label, duration_seconds,
                                reps, loop_group, loop_rounds)
     select $1, s.ord - 1, s.kind, s.exercise_id, s.label, s.duration, s.reps, s.loop_group, s.loop_rounds
       from unnest($2::text[], $3::uuid[], $4::text[], $5::int[], $6::int[], $7::smallint[], $8::smallint[])
            with ordinality as s(kind, exercise_id, label, duration, reps, loop_group, loop_rounds, ord)`,
    [
      programId,
      steps.map((step) => step.kind),
      steps.map((step) => step.exerciseId),
      steps.map((step) => step.label),
      steps.map((step) => step.durationSeconds),
      steps.map((step) => step.reps),
      steps.map((step) => step.loopGroup),
      steps.map((step) => (step.loopGroup === null ? null : step.loopRounds)),
    ],
  );
}

/** La catégorie s'ajoute à sa liste si elle n'y figure pas encore. */
async function rememberCategory(category: string | null): Promise<void> {
  if (!category) return;
  await query(`insert into catalog (kind, name) values ('program_category', $1) on conflict do nothing`, [category]);
}

export async function createProgram(input: ProgramInput): Promise<string> {
  await rememberCategory(input.category);
  const rows = await query<{ id: string }>(
    `insert into programs (name, category, notes, prep_seconds, sound)
     values ($1, $2, $3, $4, $5) returning id`,
    [input.name, input.category, input.notes, input.prepSeconds, input.sound],
  );
  const id = rows[0].id;
  await writeSteps(id, input.steps);
  return id;
}

export async function updateProgram(id: string, input: ProgramInput): Promise<boolean> {
  await rememberCategory(input.category);
  const rows = await query<{ id: string }>(
    `update programs
        set name = $2, category = $3, notes = $4, prep_seconds = $5,
            sound = $6, updated_at = now()
      where id = $1 returning id`,
    [id, input.name, input.category, input.notes, input.prepSeconds, input.sound],
  );
  if (rows.length === 0) return false;
  await writeSteps(id, input.steps);
  return true;
}

export async function deleteProgram(id: string): Promise<void> {
  await query(`delete from programs where id = $1`, [id]);
}

/** Copie un programme, pour en faire une variante sans toucher à l'original. */
export async function duplicateProgram(id: string): Promise<string | null> {
  const program = await getProgram(id);
  if (!program) return null;
  return createProgram({
    ...program,
    name: `${program.name} (copie)`,
    steps: program.steps.map(({ kind, exerciseId, label, durationSeconds, reps, loopGroup, loopRounds }) => ({
      kind,
      exerciseId,
      label,
      durationSeconds,
      reps,
      loopGroup,
      loopRounds,
    })),
  });
}

export async function getProgram(id: string): Promise<Program | null> {
  const programs = await query<{
    id: string;
    name: string;
    category: string | null;
    notes: string | null;
    prep_seconds: number;
    sound: string;
  }>(`select id, name, category, notes, prep_seconds, sound from programs where id = $1`, [id]);
  const program = programs[0];
  if (!program) return null;

  const steps = await query<{
    kind: string;
    exercise_id: string | null;
    label: string | null;
    duration_seconds: number;
    reps: number | null;
    loop_group: number | null;
    loop_rounds: number | null;
    exercise_name: string | null;
    muscles: string[] | null;
  }>(
    `select s.kind, s.exercise_id, s.label, s.duration_seconds, s.reps, s.loop_group, s.loop_rounds,
            e.name as exercise_name, e.muscles
       from program_steps s
       left join exercises e on e.id = s.exercise_id
      where s.program_id = $1
      order by s.position`,
    [id],
  );

  return {
    id: program.id,
    name: program.name,
    category: program.category,
    notes: program.notes,
    prepSeconds: program.prep_seconds,
    sound: isSound(program.sound) ? program.sound : "gong",
    steps: steps.map((row) => {
      const kind = isKind(row.kind) ? row.kind : "exercise";
      return {
        kind,
        exerciseId: row.exercise_id,
        label: row.label,
        durationSeconds: row.duration_seconds,
        reps: kind === "exercise" ? row.reps : null,
        loopGroup: row.loop_group,
        loopRounds: row.loop_group === null ? 1 : (row.loop_rounds ?? 1),
        name: stepName(row.exercise_name, row.label, kind),
        muscles: normalizeMuscles(row.muscles ?? []),
      };
    }),
  };
}

/** « Squat — jambe gauche », « Squat », « Récup ». */
export function stepName(exerciseName: string | null, label: string | null, kind: StepKind = "exercise"): string {
  if (kind !== "exercise") return STEP_KIND_LABELS[kind];
  if (exerciseName && label) return `${exerciseName} — ${label}`;
  return exerciseName ?? label ?? STEP_KIND_LABELS[kind];
}

/** Les étapes telles qu'elles sont jouées : chaque boucle déroulée. */
export function sessionSteps<T extends Loopable>(steps: T[]): T[] {
  return stepBlocks(steps).flatMap((block) =>
    Array.from({ length: block.loop?.rounds ?? 1 }, () => block.steps).flat(),
  );
}

export async function listPrograms(): Promise<ProgramSummary[]> {
  const rows = await query<{
    id: string;
    name: string;
    category: string | null;
    step_count: number | string;
    total_seconds: number | string;
    last_done_at: string | Date | null;
  }>(
    `select p.id, p.name, p.category,
            count(s.id) as step_count,
            coalesce(sum(s.duration_seconds * coalesce(s.loop_rounds, 1)), 0) as total_seconds,
            (select max(w.started_at) from workout_sessions w
              where w.program_id = p.id) as last_done_at
       from programs p
       left join program_steps s on s.program_id = p.id
      group by p.id
      order by last_done_at desc nulls last, lower(p.name)`,
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    stepCount: Number(row.step_count),
    totalSeconds: Number(row.total_seconds),
    lastDoneAt: row.last_done_at ? new Date(row.last_done_at) : null,
  }));
}
