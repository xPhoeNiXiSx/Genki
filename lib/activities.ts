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
};

const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);
const STRENGTH_TYPES = new Set(["WeightTraining", "Workout", "Crossfit", "Yoga", "Pilates", "HighIntensityIntervalTraining"]);

/** Une course coche une séance de course, un renfo une séance de renfo. */
export function planKindOf(sportType: string): "course" | "renfo" | null {
  if (RUN_TYPES.has(sportType)) return "course";
  if (STRENGTH_TYPES.has(sportType)) return "renfo";
  return null;
}

/** Enregistre des activités ; renvoie celles qui sont nouvelles. */
export async function saveActivities(list: Activity[]): Promise<Activity[]> {
  if (list.length === 0) return [];
  const rows = await query<{ id: string }>(
    `insert into activities (id, source, name, sport_type, start_date, moving_seconds, elapsed_seconds, distance_meters, climb_meters)
     select a.id, a.source, a.name, a.sport_type, a.start_date, a.moving_seconds, a.elapsed_seconds, a.distance_meters, a.climb_meters
       from json_to_recordset($1::json) as a(id text, source text, name text, sport_type text, start_date timestamptz,
            moving_seconds integer, elapsed_seconds integer, distance_meters integer, climb_meters integer)
     on conflict (id) do nothing
     returning id`,
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
        })),
      ),
    ],
  );
  const fresh = new Set(rows.map((r) => r.id));
  return list.filter((a) => fresh.has(a.id));
}
