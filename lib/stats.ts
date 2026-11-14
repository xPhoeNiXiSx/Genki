import { query } from "@/lib/db";
import { RUN_TYPES } from "@/lib/activities";
import { PLAN_START, PLAN_WEEKS } from "@/lib/plan-data";
import type { WellnessDay } from "@/lib/wellness";

/**
 * Les chiffres de la page Stats, calculés depuis les sorties importées
 * (intervals.icu ← Garmin), le plan et les données santé de la montre.
 */

const RUNS = [...RUN_TYPES];

export function addDays(iso: string, n: number): string {
  return new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

/** Lundi de la semaine d'une date. */
export function mondayOf(iso: string): string {
  const day = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return addDays(iso, -((day + 6) % 7));
}

export type WeekVolume = { monday: string; label: string; km: number; plannedKm: number; current: boolean };

/** Km courus par semaine (lundi → dimanche), et km prévus quand la semaine est dans le plan. */
export async function weeklyVolume(today: string, count = 8): Promise<WeekVolume[]> {
  const current = mondayOf(today);
  const first = addDays(current, -7 * (count - 1));
  const rows = await query<{ monday: string; meters: string | number }>(
    `select to_char(date_trunc('week', start_date at time zone 'Europe/Paris'), 'YYYY-MM-DD') as monday, sum(distance_meters) as meters
       from activities
      where sport_type = any($1::text[]) and (start_date at time zone 'Europe/Paris')::date between $2 and $3
      group by 1`,
    [RUNS, first, addDays(current, 6)],
  );
  const byMonday = new Map(rows.map((r) => [r.monday, Number(r.meters)]));
  return Array.from({ length: count }, (_, i) => {
    const monday = addDays(first, 7 * i);
    const week = PLAN_WEEKS.find((w) => w.monday === monday);
    const [, m, d] = monday.split("-");
    return {
      monday,
      label: week ? `S${week.week}` : `${d}/${m}`,
      km: Math.round((byMonday.get(monday) ?? 0) / 100) / 10,
      plannedKm: week?.km ?? 0,
      current: monday === current,
    };
  });
}

export type PaceGroup = { name: string; runs: number; secondsPerKm: number | null; avgHr: number | null; longestKm: number | null };

const EASY_TITLES = new Set(["Footing en endurance", "Footing tranquille", "Footing + lignes droites"]);

/**
 * Allures des 4 dernières semaines, par type de sortie. Une sortie liée au
 * plan prend le type de sa séance ; sinon, plus d'1 h 15 compte comme
 * sortie longue, le reste comme endurance.
 */
export async function paceGroups(today: string): Promise<PaceGroup[]> {
  const rows = await query<{ moving_seconds: number; distance_meters: number; avg_hr: number | null; title: string | null }>(
    `select a.moving_seconds, a.distance_meters, a.avg_hr, p.title
       from activities a left join plan_sessions p on p.activity_id = a.id
      where a.sport_type = any($1::text[]) and a.distance_meters > 0
        and (a.start_date at time zone 'Europe/Paris')::date between $2 and $3`,
    [RUNS, addDays(today, -27), today],
  );
  const groups = { easy: [] as typeof rows, long: [] as typeof rows, quality: [] as typeof rows };
  for (const r of rows) {
    if (r.title === "Sortie longue" || (!r.title && r.moving_seconds >= 75 * 60)) groups.long.push(r);
    else if (!r.title || EASY_TITLES.has(r.title)) groups.easy.push(r);
    else groups.quality.push(r);
  }
  const summary = (name: string, list: typeof rows): PaceGroup => {
    const seconds = list.reduce((s, r) => s + r.moving_seconds, 0);
    const meters = list.reduce((s, r) => s + r.distance_meters, 0);
    const withHr = list.filter((r) => r.avg_hr);
    const hrSeconds = withHr.reduce((s, r) => s + r.moving_seconds, 0);
    return {
      name,
      runs: list.length,
      secondsPerKm: meters > 0 ? Math.round(seconds / (meters / 1000)) : null,
      avgHr: hrSeconds > 0 ? Math.round(withHr.reduce((s, r) => s + (r.avg_hr ?? 0) * r.moving_seconds, 0) / hrSeconds) : null,
      longestKm: list.length ? Math.round(Math.max(...list.map((r) => r.distance_meters)) / 100) / 10 : null,
    };
  };
  return [summary("Endurance", groups.easy), summary("Sortie longue", groups.long), summary("Fractions & côtes", groups.quality)];
}

export type PlanTotals = { km: number; climb: number; seconds: number; done: number; total: number };

/** Ce qui a été couru depuis le début du plan, et les séances cochées. */
export async function planTotals(): Promise<PlanTotals> {
  const [runs, sessions] = await Promise.all([
    query<{ meters: string | number | null; climb: string | number | null; seconds: string | number | null }>(
      `select sum(distance_meters) as meters, sum(climb_meters) as climb, sum(moving_seconds) as seconds
         from activities where sport_type = any($1::text[]) and (start_date at time zone 'Europe/Paris')::date >= $2`,
      [RUNS, PLAN_START],
    ),
    query<{ done: string | number; total: string | number }>(
      `select count(*) filter (where status = 'done') as done, count(*) as total from plan_sessions`,
    ),
  ]);
  return {
    km: Math.round(Number(runs[0]?.meters ?? 0) / 100) / 10,
    climb: Math.round(Number(runs[0]?.climb ?? 0)),
    seconds: Number(runs[0]?.seconds ?? 0),
    done: Number(sessions[0]?.done ?? 0),
    total: Number(sessions[0]?.total ?? 0),
  };
}

export type Form = { ctl: number; atl: number; tsb: number; ctlWeekAgo: number | null; day: string };

/** Forme du jour le plus récent qui en a une, et la forme 7 jours plus tôt. */
export function formOf(days: WellnessDay[]): Form | null {
  const withForm = days.filter((d) => d.ctl !== null && d.atl !== null);
  const last = withForm.at(-1);
  if (!last) return null;
  const weekAgo = withForm.find((d) => d.day === addDays(last.day, -7));
  const ctl = Math.round(last.ctl!);
  const atl = Math.round(last.atl!);
  return { ctl, atl, tsb: ctl - atl, ctlWeekAgo: weekAgo ? Math.round(weekAgo.ctl!) : null, day: last.day };
}

/** Ce que veut dire la fraîcheur (forme − fatigue), en une phrase. */
export function freshnessText(tsb: number): string {
  if (tsb < -20) return "très chargé : soigne la récup, rien à rattraper";
  if (tsb < -5) return "en charge : normal en plein bloc";
  if (tsb <= 5) return "équilibré";
  return "frais : prêt pour une séance dure";
}

export type Recovery = { restingHr: number | null; hrv: number | null; hrvAvg: number | null; sleepSecs: number | null; vo2max: number | null };

/** Récup vue par la montre : dernière valeur connue, sommeil et VFC moyens sur 7 nuits. */
export function recoveryOf(days: WellnessDay[]): Recovery {
  const latest = <K extends keyof WellnessDay>(key: K) => [...days].reverse().find((d) => d[key] !== null)?.[key] ?? null;
  const recent = days.slice(-7);
  const avg = (values: (number | null)[]) => {
    const list = values.filter((v): v is number => v !== null);
    return list.length ? list.reduce((s, v) => s + v, 0) / list.length : null;
  };
  const sleep = avg(recent.map((d) => d.sleepSecs));
  const hrvAvg = avg(recent.map((d) => d.hrv));
  return {
    restingHr: latest("restingHr") as number | null,
    hrv: latest("hrv") as number | null,
    hrvAvg: hrvAvg === null ? null : Math.round(hrvAvg),
    sleepSecs: sleep === null ? null : Math.round(sleep),
    vo2max: latest("vo2max") as number | null,
  };
}

/** « 6:54 /km ». */
export function paceLabel(secondsPerKm: number): string {
  return `${Math.floor(secondsPerKm / 60)}:${String(secondsPerKm % 60).padStart(2, "0")} /km`;
}

/** Jours (heure de Paris) où une course ou un renfo a été importé, entre deux dates. */
export async function activeDays(from: string, to: string): Promise<Set<string>> {
  const rows = await query<{ day: string }>(
    `select distinct to_char((start_date at time zone 'Europe/Paris')::date, 'YYYY-MM-DD') as day
       from activities where (start_date at time zone 'Europe/Paris')::date between $1 and $2`,
    [from, to],
  );
  return new Set(rows.map((r) => r.day));
}
