import { query } from "@/lib/db";
import { MAX_STEP_SECONDS, parseDuration } from "@/lib/duration";
import { normalizeMuscles, type MuscleKey } from "@/lib/muscles";

/**
 * Une étape renvoie soit à un exercice de la bibliothèque, soit à un simple
 * libellé (« Repos », « Échauffement libre »). Les deux peuvent coexister :
 * le libellé précise alors l'exercice (« Squat — jambe gauche »).
 */
export type StepInput = {
  exerciseId: string | null;
  label: string | null;
  durationSeconds: number;
};

export type ProgramInput = {
  name: string;
  notes: string | null;
  steps: StepInput[];
};

/** Une étape prête pour la séance : le nom à afficher et les muscles. */
export type Step = StepInput & {
  name: string;
  muscles: MuscleKey[];
};

export type Program = {
  id: string;
  name: string;
  notes: string | null;
  steps: Step[];
};

export type ProgramSummary = {
  id: string;
  name: string;
  stepCount: number;
  totalSeconds: number;
  lastDoneAt: Date | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lit le formulaire d'un programme. Les étapes arrivent en champs répétés,
 * dans l'ordre : `stepExercise`, `stepLabel`, `stepDuration`.
 */
export function parseProgramForm(
  form: FormData,
): { input: ProgramInput } | { error: string } {
  const text = (value: FormDataEntryValue | null) =>
    typeof value === "string" ? value.trim() : "";

  const name = text(form.get("name"));
  if (!name) return { error: "Donne un nom au programme." };

  const exercises = form.getAll("stepExercise").map(text);
  const labels = form.getAll("stepLabel").map(text);
  const durations = form.getAll("stepDuration").map(text);
  const count = Math.max(exercises.length, labels.length, durations.length);

  const steps: StepInput[] = [];
  for (let i = 0; i < count; i += 1) {
    const exerciseId = exercises[i] ?? "";
    const label = labels[i] ?? "";
    const rawDuration = durations[i] ?? "";

    // Ligne laissée entièrement vide : on l'ignore, sans reproche.
    if (!exerciseId && !label && !rawDuration) continue;

    const position = `Étape ${steps.length + 1}`;
    if (exerciseId && !UUID.test(exerciseId)) {
      return { error: `${position} : exercice inconnu.` };
    }
    if (!exerciseId && !label) {
      return { error: `${position} : choisis un exercice ou écris un libellé.` };
    }
    const durationSeconds = parseDuration(rawDuration);
    if (durationSeconds === null) {
      return { error: `${position} : durée illisible. Écris par exemple 45 ou 1:30.` };
    }
    if (durationSeconds > MAX_STEP_SECONDS) {
      return { error: `${position} : une étape ne dépasse pas 3 heures.` };
    }

    steps.push({ exerciseId: exerciseId || null, label: label || null, durationSeconds });
  }

  if (steps.length === 0) return { error: "Ajoute au moins une étape." };

  const notes = text(form.get("notes"));
  return { input: { name, notes: notes || null, steps } };
}

/**
 * Remplace toutes les étapes d'un programme, en une seule instruction : le
 * pilote HTTP de Neon n'offre pas de transaction entre deux requêtes, et un
 * échec entre l'effacement et la réécriture laisserait un programme vide.
 */
async function writeSteps(programId: string, steps: StepInput[]): Promise<void> {
  await query(
    `with gone as (delete from program_steps where program_id = $1)
     insert into program_steps (program_id, position, exercise_id, label, duration_seconds)
     select $1, s.ord - 1, s.exercise_id, s.label, s.duration
       from unnest($2::uuid[], $3::text[], $4::int[])
            with ordinality as s(exercise_id, label, duration, ord)`,
    [
      programId,
      steps.map((step) => step.exerciseId),
      steps.map((step) => step.label),
      steps.map((step) => step.durationSeconds),
    ],
  );
}

export async function createProgram(input: ProgramInput): Promise<string> {
  const rows = await query<{ id: string }>(
    `insert into programs (name, notes) values ($1, $2) returning id`,
    [input.name, input.notes],
  );
  const id = rows[0].id;
  await writeSteps(id, input.steps);
  return id;
}

export async function updateProgram(id: string, input: ProgramInput): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `update programs set name = $2, notes = $3, updated_at = now()
      where id = $1 returning id`,
    [id, input.name, input.notes],
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
    name: `${program.name} (copie)`,
    notes: program.notes,
    steps: program.steps.map(({ exerciseId, label, durationSeconds }) => ({
      exerciseId,
      label,
      durationSeconds,
    })),
  });
}

export async function getProgram(id: string): Promise<Program | null> {
  const programs = await query<{ id: string; name: string; notes: string | null }>(
    `select id, name, notes from programs where id = $1`,
    [id],
  );
  const program = programs[0];
  if (!program) return null;

  const steps = await query<{
    exercise_id: string | null;
    label: string | null;
    duration_seconds: number;
    exercise_name: string | null;
    muscles: string[] | null;
  }>(
    `select s.exercise_id, s.label, s.duration_seconds,
            e.name as exercise_name, e.muscles
       from program_steps s
       left join exercises e on e.id = s.exercise_id
      where s.program_id = $1
      order by s.position`,
    [id],
  );

  return {
    ...program,
    steps: steps.map((row) => ({
      exerciseId: row.exercise_id,
      label: row.label,
      durationSeconds: row.duration_seconds,
      name: stepName(row.exercise_name, row.label),
      muscles: normalizeMuscles(row.muscles ?? []),
    })),
  };
}

/** « Squat — jambe gauche », « Squat » ou « Repos ». */
export function stepName(exerciseName: string | null, label: string | null): string {
  if (exerciseName && label) return `${exerciseName} — ${label}`;
  return exerciseName ?? label ?? "Étape";
}

export async function listPrograms(): Promise<ProgramSummary[]> {
  const rows = await query<{
    id: string;
    name: string;
    step_count: number | string;
    total_seconds: number | string;
    last_done_at: string | Date | null;
  }>(
    `select p.id, p.name,
            count(s.id) as step_count,
            coalesce(sum(s.duration_seconds), 0) as total_seconds,
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
    stepCount: Number(row.step_count),
    totalSeconds: Number(row.total_seconds),
    lastDoneAt: row.last_done_at ? new Date(row.last_done_at) : null,
  }));
}
