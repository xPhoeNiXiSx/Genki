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
};

export type WorkoutInput = Omit<Workout, "id">;

export async function recordWorkout(input: WorkoutInput): Promise<string> {
  const rows = await query<{ id: string }>(
    `insert into workout_sessions
       (program_id, program_name, started_at, duration_seconds, completed)
     values ($1, $2, $3, $4, $5)
     returning id`,
    [
      input.programId,
      input.programName,
      input.startedAt.toISOString(),
      Math.max(0, Math.round(input.durationSeconds)),
      input.completed,
    ],
  );
  return rows[0].id;
}

export async function listWorkouts(limit = 50): Promise<Workout[]> {
  const rows = await query<{
    id: string;
    program_id: string | null;
    program_name: string;
    started_at: string | Date;
    duration_seconds: number;
    completed: boolean;
  }>(
    `select id, program_id, program_name, started_at, duration_seconds, completed
       from workout_sessions
      order by started_at desc
      limit $1`,
    [limit],
  );

  return rows.map((row) => ({
    id: row.id,
    programId: row.program_id,
    programName: row.program_name,
    startedAt: new Date(row.started_at),
    durationSeconds: row.duration_seconds,
    completed: row.completed,
  }));
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
