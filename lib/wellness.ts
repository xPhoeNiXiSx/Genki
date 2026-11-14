import { query } from "@/lib/db";

/**
 * Données santé d'un jour, telles que la montre (Garmin) les envoie à
 * intervals.icu, avec la forme qu'intervals.icu calcule à partir des sorties.
 */
export type WellnessDay = {
  day: string;
  /** Forme : charge d'entraînement moyenne sur ~6 semaines. */
  ctl: number | null;
  /** Fatigue : charge moyenne sur ~7 jours. */
  atl: number | null;
  restingHr: number | null;
  hrv: number | null;
  sleepSecs: number | null;
  vo2max: number | null;
};

/** Ce qu'intervals.icu renvoie d'une journée « wellness », pour ce qui nous sert. */
export type IntervalsWellness = {
  id: string;
  ctl?: number | null;
  atl?: number | null;
  restingHR?: number | null;
  hrv?: number | null;
  sleepSecs?: number | null;
  vo2max?: number | null;
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const round1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

export function fromIntervalsWellness(w: IntervalsWellness): WellnessDay | null {
  if (typeof w.id !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(w.id)) return null;
  const restingHr = num(w.restingHR);
  const sleep = num(w.sleepSecs);
  return {
    day: w.id,
    ctl: round1(num(w.ctl)),
    atl: round1(num(w.atl)),
    restingHr: restingHr === null ? null : Math.round(restingHr),
    hrv: round1(num(w.hrv)),
    sleepSecs: sleep === null ? null : Math.round(sleep),
    vo2max: round1(num(w.vo2max)),
  };
}

/** Enregistre les journées (une journée déjà connue est remplacée). */
export async function saveWellness(days: WellnessDay[]): Promise<void> {
  if (days.length === 0) return;
  await query(
    `insert into wellness (day, ctl, atl, resting_hr, hrv, sleep_secs, vo2max)
     select w.day, w.ctl, w.atl, w.resting_hr, w.hrv, w.sleep_secs, w.vo2max
       from json_to_recordset($1::json) as w(day date, ctl numeric, atl numeric, resting_hr smallint, hrv numeric, sleep_secs integer, vo2max numeric)
     on conflict (day) do update
       set ctl = excluded.ctl, atl = excluded.atl, resting_hr = excluded.resting_hr, hrv = excluded.hrv,
           sleep_secs = excluded.sleep_secs, vo2max = excluded.vo2max, updated_at = now()`,
    [
      JSON.stringify(
        days.map((d) => ({ day: d.day, ctl: d.ctl, atl: d.atl, resting_hr: d.restingHr, hrv: d.hrv, sleep_secs: d.sleepSecs, vo2max: d.vo2max })),
      ),
    ],
  );
}

/** Les journées connues, de la plus ancienne à la plus récente, jusqu'à `until`. */
export async function listWellness(since: string, until: string): Promise<WellnessDay[]> {
  const rows = await query<{ day: string; ctl: string | null; atl: string | null; resting_hr: number | null; hrv: string | null; sleep_secs: number | null; vo2max: string | null }>(
    `select to_char(day, 'YYYY-MM-DD') as day, ctl, atl, resting_hr, hrv, sleep_secs, vo2max
       from wellness where day between $1 and $2 order by day`,
    [since, until],
  );
  const n = (v: string | number | null) => (v === null ? null : Number(v));
  return rows.map((r) => ({ day: r.day, ctl: n(r.ctl), atl: n(r.atl), restingHr: r.resting_hr, hrv: n(r.hrv), sleepSecs: r.sleep_secs, vo2max: n(r.vo2max) }));
}
