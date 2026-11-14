import { query } from "@/lib/db";

/** Une sortie importée d'un service extérieur (intervals.icu). */
export type Activity = {
  /** Préfixé par le service : « intervals:i123 ». */
  id: string;
  source: string;
  name: string;
  sportType: string;
  startDate: Date;
  /** Jour local de l'activité, « AAAA-MM-JJ » : il range la sortie dans sa semaine. */
  localDate: string;
  movingSeconds: number;
  elapsedSeconds: number;
  distanceMeters: number;
  climbMeters: number;
  /** Fréquence cardiaque moyenne, si la montre l'a mesurée. */
  avgHr?: number | null;
};

export const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);
const STRENGTH_TYPES = new Set(["WeightTraining", "Workout", "Crossfit", "Yoga", "Pilates", "HighIntensityIntervalTraining"]);

/** Une course coche une séance de course, un renfo une séance de renfo. */
export function planKindOf(sportType: string): "course" | "renfo" | null {
  if (RUN_TYPES.has(sportType)) return "course";
  if (STRENGTH_TYPES.has(sportType)) return "renfo";
  return null;
}

/**
 * Enregistre des activités ; renvoie celles qui sont nouvelles. Une activité
 * déjà connue reçoit seulement sa fréquence cardiaque si elle manquait.
 */
export async function saveActivities(list: Activity[]): Promise<Activity[]> {
  if (list.length === 0) return [];
  const rows = await query<{ id: string; inserted: boolean }>(
    `insert into activities (id, source, name, sport_type, start_date, moving_seconds, elapsed_seconds, distance_meters, climb_meters, avg_hr)
     select a.id, a.source, a.name, a.sport_type, a.start_date, a.moving_seconds, a.elapsed_seconds, a.distance_meters, a.climb_meters, a.avg_hr
       from json_to_recordset($1::json) as a(id text, source text, name text, sport_type text, start_date timestamptz,
            moving_seconds integer, elapsed_seconds integer, distance_meters integer, climb_meters integer, avg_hr smallint)
     on conflict (id) do update set avg_hr = coalesce(activities.avg_hr, excluded.avg_hr)
     returning id, (xmax = 0) as inserted`,
    [
      JSON.stringify(
        list.map((a) => ({
          id: a.id,
          source: a.source,
          name: a.name,
          sport_type: a.sportType,
          start_date: a.startDate.toISOString(),
          moving_seconds: a.movingSeconds,
          elapsed_seconds: a.elapsedSeconds,
          distance_meters: a.distanceMeters,
          climb_meters: a.climbMeters,
          avg_hr: a.avgHr ?? null,
        })),
      ),
    ],
  );
  const fresh = new Set(rows.filter((r) => r.inserted).map((r) => r.id));
  return list.filter((a) => fresh.has(a.id));
}

export type ActivityRow = {
  id: string;
  name: string;
  sportType: string;
  /** Jour local (Paris), « AAAA-MM-JJ ». */
  day: string;
  movingSeconds: number;
  distanceMeters: number;
  climbMeters: number;
  avgHr: number | null;
  /** Titre de la séance du plan que la sortie a cochée. */
  planTitle: string | null;
};

/** Les activités importées depuis une date, les plus récentes d'abord. */
export async function listActivities(since: string): Promise<ActivityRow[]> {
  const rows = await query<{ id: string; name: string; sport_type: string; day: string; moving_seconds: number; distance_meters: number; climb_meters: number; avg_hr: number | null; plan_title: string | null }>(
    `select a.id, a.name, a.sport_type, to_char((a.start_date at time zone 'Europe/Paris')::date, 'YYYY-MM-DD') as day,
            a.moving_seconds, a.distance_meters, a.climb_meters, a.avg_hr, p.title as plan_title
       from activities a left join plan_sessions p on p.activity_id = a.id
      where (a.start_date at time zone 'Europe/Paris')::date >= $1
      order by a.start_date desc`,
    [since],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    sportType: r.sport_type,
    day: r.day,
    movingSeconds: r.moving_seconds,
    distanceMeters: r.distance_meters,
    climbMeters: r.climb_meters,
    avgHr: r.avg_hr,
    planTitle: r.plan_title,
  }));
}
