import { query } from "@/lib/db";

/**
 * Historique des séances. Une séance interrompue est enregistrée aussi, avec
 * le temps réellement fait : c'est une information pour le suivi kiné.
 */

export const TIME_ZONE = "Europe/Paris";

export type Workout = {
  id: string;
  programId: string | null;
  programName: string;
  startedAt: Date;
  durationSeconds: number;
  completed: boolean;
  /** Ressenti de 1 (très dur) à 5 (facile). */
  feeling: number | null;
  /** Note libre, pour le kiné. */
  note: string | null;
  stepsDone: number | null;
  stepsTotal: number | null;
};

export type WorkoutInput = Omit<Workout, "id" | "feeling" | "note" | "stepsDone" | "stepsTotal"> &
  Partial<Pick<Workout, "feeling" | "note" | "stepsDone" | "stepsTotal">>;

type WorkoutRow = {
  id: string;
  program_id: string | null;
  program_name: string;
  started_at: string | Date;
  duration_seconds: number;
  completed: boolean;
  feeling: number | null;
  note: string | null;
  steps_done: number | null;
  steps_total: number | null;
};

const WORKOUT_COLUMNS = `id, program_id, program_name, started_at, duration_seconds, completed,
                         feeling, note, steps_done, steps_total`;

function fromRow(row: WorkoutRow): Workout {
  return {
    id: row.id,
    programId: row.program_id,
    programName: row.program_name,
    startedAt: new Date(row.started_at),
    durationSeconds: row.duration_seconds,
    completed: row.completed,
    feeling: row.feeling,
    note: row.note,
    stepsDone: row.steps_done,
    stepsTotal: row.steps_total,
  };
}

export async function recordWorkout(input: WorkoutInput): Promise<string> {
  const rows = await query<{ id: string }>(
    `insert into workout_sessions
       (program_id, program_name, started_at, duration_seconds, completed,
        feeling, note, steps_done, steps_total)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id`,
    [
      input.programId,
      input.programName,
      input.startedAt.toISOString(),
      Math.max(0, Math.round(input.durationSeconds)),
      input.completed,
      input.feeling ?? null,
      input.note ?? null,
      input.stepsDone ?? null,
      input.stepsTotal ?? null,
    ],
  );
  return rows[0].id;
}

export async function listWorkouts(limit = 50): Promise<Workout[]> {
  const rows = await query<WorkoutRow>(
    `select ${WORKOUT_COLUMNS} from workout_sessions order by started_at desc limit $1`,
    [limit],
  );
  return rows.map(fromRow);
}

export async function getWorkout(id: string): Promise<Workout | null> {
  const rows = await query<WorkoutRow>(`select ${WORKOUT_COLUMNS} from workout_sessions where id = $1`, [id]);
  return rows[0] ? fromRow(rows[0]) : null;
}

/**
 * Série en cours : jours consécutifs avec au moins une séance, en remontant
 * depuis aujourd'hui (ou depuis hier, si rien n'est encore fait aujourd'hui).
 */
export async function currentStreak(now = new Date()): Promise<number> {
  const rows = await query<{ day: string }>(
    `select distinct to_char((started_at at time zone '${TIME_ZONE}')::date, 'YYYY-MM-DD') as day
       from workout_sessions
      where started_at > $1::timestamptz - interval '400 days'
      order by day desc`,
    [now.toISOString()],
  );
  const days = new Set(rows.map((r) => r.day));
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });
  const day = (offset: number) => fmt.format(new Date(now.getTime() - offset * 86_400_000));
  let offset = days.has(day(0)) ? 0 : 1;
  let streak = 0;
  while (days.has(day(offset))) {
    streak += 1;
    offset += 1;
  }
  return streak;
}

/** Ajoute le bilan d'une séance déjà enregistrée : ressenti et note. */
export async function reviewWorkout(id: string, feeling: number | null, note: string | null): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `update workout_sessions set feeling = $2, note = $3 where id = $1 returning id`,
    [id, feeling, note],
  );
  return rows.length > 0;
}

export async function deleteWorkout(id: string): Promise<void> {
  await query(`delete from workout_sessions where id = $1`, [id]);
}

export type WeekTotal = {
  /** Lundi de la semaine, « AAAA-MM-JJ », heure de Paris. */
  week: string;
  seconds: number;
  sessions: number;
};

/**
 * Temps d'entraînement par semaine (du lundi au dimanche, heure de Paris),
 * des `weeks` dernières semaines, la plus récente en premier. Les semaines
 * sans séance sont présentes, à zéro : une courbe doit montrer les creux.
 */
export async function weeklyTotals(weeks: number, now = new Date()): Promise<WeekTotal[]> {
  const rows = await query<{ week: string; seconds: number | string; sessions: number | string }>(
    `with bounds as (
       select date_trunc('week', ($1::timestamptz at time zone '${TIME_ZONE}'))::date as this_week
     ),
     series as (
       select (this_week - (n * 7))::date as week
         from bounds, generate_series(0, $2 - 1) as n
     )
     select to_char(series.week, 'YYYY-MM-DD') as week,
            coalesce(sum(w.duration_seconds), 0) as seconds,
            count(w.id) as sessions
       from series
       left join workout_sessions w
         on date_trunc('week', w.started_at at time zone '${TIME_ZONE}')::date = series.week
      group by series.week
      order by series.week desc`,
    [now.toISOString(), weeks],
  );

  return rows.map((row) => ({
    week: row.week,
    seconds: Number(row.seconds),
    sessions: Number(row.sessions),
  }));
}

export type DayTotal = {
  /** « AAAA-MM-JJ », heure de Paris. */
  day: string;
  seconds: number;
};

/** Temps d'entraînement de chaque jour de la semaine en cours, du lundi au dimanche. */
export async function dailyTotals(now = new Date()): Promise<DayTotal[]> {
  const rows = await query<{ day: string; seconds: number | string }>(
    `with bounds as (
       select date_trunc('week', ($1::timestamptz at time zone '${TIME_ZONE}'))::date as monday
     ),
     days as (
       select (monday + n)::date as day from bounds, generate_series(0, 6) as n
     )
     select to_char(days.day, 'YYYY-MM-DD') as day,
            coalesce(sum(w.duration_seconds), 0) as seconds
       from days
       left join workout_sessions w
         on (w.started_at at time zone '${TIME_ZONE}')::date = days.day
      group by days.day
      order by days.day`,
    [now.toISOString()],
  );
  return rows.map((row) => ({ day: row.day, seconds: Number(row.seconds) }));
}
