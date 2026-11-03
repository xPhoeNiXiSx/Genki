import { query } from "@/lib/db";
import { PLAN_START, PLAN_WEEKS, plannedSessions, type PlanBlock, type PlanKind, type PlanWeek } from "@/lib/plan-data";
import { planKindOf, type Activity } from "@/lib/activities";

export type PlanStatus = "todo" | "done" | "skipped";

export type PlanSession = {
  id: string;
  week: number;
  position: number;
  kind: PlanKind;
  title: string;
  summary: string;
  why: string;
  blocks: PlanBlock[];
  targetSeconds: number;
  targetMeters: number | null;
  targetClimb: number | null;
  status: PlanStatus;
  doneAt: Date | null;
  actualSeconds: number | null;
  actualMeters: number | null;
  actualClimb: number | null;
  feeling: number | null;
  note: string | null;
  /** Activité importée (intervals.icu) qui a coché la séance. */
  activityId: string | null;
};

type Row = {
  id: string;
  week: number;
  position: number;
  kind: string;
  title: string;
  summary: string;
  why: string;
  blocks: PlanBlock[];
  target_seconds: number;
  target_meters: number | null;
  target_climb: number | null;
  status: string;
  done_at: string | Date | null;
  actual_seconds: number | null;
  actual_meters: number | null;
  actual_climb: number | null;
  feeling: number | null;
  note: string | null;
  activity_id: string | null;
};

const COLUMNS = `id, week, position, kind, title, summary, why, blocks, target_seconds, target_meters,
  target_climb, status, done_at, actual_seconds, actual_meters, actual_climb, feeling, note, activity_id`;

function fromRow(row: Row): PlanSession {
  return {
    id: row.id,
    week: row.week,
    position: row.position,
    kind: row.kind === "renfo" ? "renfo" : "course",
    title: row.title,
    summary: row.summary,
    why: row.why,
    blocks: Array.isArray(row.blocks) ? row.blocks : [],
    targetSeconds: row.target_seconds,
    targetMeters: row.target_meters,
    targetClimb: row.target_climb,
    status: row.status === "done" || row.status === "skipped" ? row.status : "todo",
    doneAt: row.done_at ? new Date(row.done_at) : null,
    actualSeconds: row.actual_seconds,
    actualMeters: row.actual_meters,
    actualClimb: row.actual_climb,
    feeling: row.feeling,
    note: row.note,
    activityId: row.activity_id,
  };
}

/**
 * Enregistre les séances du plan qui manquent. Rejouable : une séance déjà
 * là (et ce qui a été réalisé) n'est jamais touchée.
 */
export async function ensurePlan(): Promise<void> {
  const sessions = plannedSessions();
  await query(
    `insert into plan_sessions (week, position, kind, title, summary, why, blocks, target_seconds, target_meters, target_climb)
     select s.week, s.position, s.kind, s.title, s.summary, s.why, s.blocks, s.target_seconds, s.target_meters, s.target_climb
       from json_to_recordset($1::json) as s(week smallint, position smallint, kind text, title text, summary text, why text,
            blocks jsonb, target_seconds integer, target_meters integer, target_climb integer)
     on conflict (week, position) do nothing`,
    [
      JSON.stringify(
        sessions.map((s) => ({
          week: s.week,
          position: s.position,
          kind: s.kind,
          title: s.title,
          summary: s.summary,
          why: s.why,
          blocks: s.blocks,
          target_seconds: s.targetSeconds,
          target_meters: s.targetMeters,
          target_climb: s.targetClimb,
        })),
      ),
    ],
  );
}

export async function listPlanSessions(): Promise<PlanSession[]> {
  await ensurePlan();
  const rows = await query<Row>(`select ${COLUMNS} from plan_sessions order by week, position`);
  return rows.map(fromRow);
}

export async function getPlanSession(id: string): Promise<PlanSession | null> {
  const rows = await query<Row>(`select ${COLUMNS} from plan_sessions where id = $1`, [id]);
  return rows[0] ? fromRow(rows[0]) : null;
}

export type PlanReport = {
  actualSeconds: number | null;
  actualMeters: number | null;
  actualClimb: number | null;
  feeling: number | null;
  note: string | null;
};

/** Coche la séance comme faite, avec ce qui a été réellement couru. */
export async function completePlanSession(id: string, report: PlanReport, now = new Date()): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `update plan_sessions
        set status = 'done', done_at = coalesce(done_at, $2), actual_seconds = $3, actual_meters = $4,
            actual_climb = $5, feeling = $6, note = $7
      where id = $1 returning id`,
    [id, now.toISOString(), report.actualSeconds, report.actualMeters, report.actualClimb, report.feeling, report.note],
  );
  return rows.length > 0;
}

/** Séance non faite (`skipped`) ou remise à faire (`todo`) : le réalisé s'efface. */
export async function setPlanStatus(id: string, status: Exclude<PlanStatus, "done">): Promise<void> {
  await query(
    `update plan_sessions
        set status = $2, done_at = null, actual_seconds = null, actual_meters = null,
            actual_climb = null, feeling = null, note = null, activity_id = null
      where id = $1`,
    [id, status],
  );
}

/** Lit le formulaire de validation. Durée « 1:24 », « 1:24:30 » ou minutes ; km avec virgule. */
export function parsePlanReport(form: FormData): { report: PlanReport } | { error: string } {
  const text = (name: string) => {
    const v = form.get(name);
    return typeof v === "string" ? v.trim() : "";
  };

  let actualSeconds: number | null = null;
  const duration = text("duration");
  if (duration) {
    const parts = duration.split(/[:h]/).map((p) => p.trim());
    if (parts.some((p) => !/^\d+$/.test(p)) || parts.length > 3) return { error: "Durée illisible : écris 1:24 ou 84." };
    const n = parts.map(Number);
    // 84 → minutes ; 1:24 → heures:minutes ; 1:24:30 → h:min:s.
    actualSeconds = n.length === 1 ? n[0] * 60 : n.length === 2 ? n[0] * 3600 + n[1] * 60 : n[0] * 3600 + n[1] * 60 + n[2];
    if (actualSeconds <= 0 || actualSeconds > 12 * 3600) return { error: "Durée hors limites." };
  }

  let actualMeters: number | null = null;
  const km = text("km").replace(",", ".");
  if (km) {
    const value = Number(km);
    if (!Number.isFinite(value) || value <= 0 || value > 200) return { error: "Distance illisible, en km." };
    actualMeters = Math.round(value * 1000);
  }

  let actualClimb: number | null = null;
  const climb = text("climb");
  if (climb) {
    const value = Number(climb);
    if (!Number.isInteger(value) || value < 0 || value > 10000) return { error: "Dénivelé illisible, en mètres." };
    actualClimb = value;
  }

  const rawFeeling = text("feeling");
  const feeling = rawFeeling ? Number(rawFeeling) : null;
  if (feeling !== null && (!Number.isInteger(feeling) || feeling < 1 || feeling > 5)) return { error: "Ressenti de 1 à 5." };

  return { report: { actualSeconds, actualMeters, actualClimb, feeling, note: text("note").slice(0, 1000) || null } };
}

/** Semaine du plan en cours à une date (1 à 16), bornée au plan. */
export function currentWeek(today: string): number {
  const start = new Date(`${PLAN_START}T12:00:00Z`).getTime();
  const at = new Date(`${today}T12:00:00Z`).getTime();
  const week = Math.floor((at - start) / (7 * 86_400_000)) + 1;
  return Math.min(PLAN_WEEKS.length, Math.max(1, week));
}

/** Jours avant la course, à une date donnée. */
export function daysToRace(today: string, race: string): number {
  return Math.round((new Date(`${race}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86_400_000);
}

export type WeekProgress = PlanWeek & { done: number; total: number; metersDone: number };

export function weekProgress(sessions: PlanSession[]): WeekProgress[] {
  return PLAN_WEEKS.map((w) => {
    const list = sessions.filter((s) => s.week === w.week);
    return {
      ...w,
      done: list.filter((s) => s.status === "done").length,
      total: list.length,
      metersDone: list.reduce((sum, s) => sum + (s.status === "done" && s.kind === "course" ? (s.actualMeters ?? 0) : 0), 0),
    };
  });
}

// --- Activités importées -----------------------------------------------------

/** Semaine du plan d'une date, ou `null` hors du plan. */
export function planWeekOf(date: string): number | null {
  const start = new Date(`${PLAN_START}T12:00:00Z`).getTime();
  const at = new Date(`${date}T12:00:00Z`).getTime();
  const week = Math.floor((at - start) / (7 * 86_400_000)) + 1;
  return week >= 1 && week <= PLAN_WEEKS.length ? week : null;
}

/**
 * Coche le plan avec des activités importées : chaque activité coche, dans
 * sa semaine, la séance à faire du même type dont la durée prévue est la
 * plus proche. Ressenti et note restent à saisir. Renvoie le nombre de
 * séances cochées.
 */
export async function matchActivities(activities: Activity[]): Promise<number> {
  if (activities.length === 0) return 0;
  const sessions = await listPlanSessions();
  let checked = 0;
  for (const a of [...activities].sort((x, y) => x.startDate.getTime() - y.startDate.getTime())) {
    const kind = planKindOf(a.sportType);
    const week = planWeekOf(a.localDate);
    if (!kind || !week || sessions.some((s) => s.activityId === a.id)) continue;
    const candidates = sessions.filter((s) => s.week === week && s.kind === kind && s.status === "todo");
    if (candidates.length === 0) continue;
    const seconds = a.movingSeconds || a.elapsedSeconds;
    const best = candidates.reduce((x, y) => (Math.abs(y.targetSeconds - seconds) < Math.abs(x.targetSeconds - seconds) ? y : x));
    const rows = await query<{ id: string }>(
      `update plan_sessions
          set status = 'done', done_at = $2, actual_seconds = $3, actual_meters = $4, actual_climb = $5, activity_id = $6
        where id = $1 and status = 'todo' returning id`,
      [best.id, a.startDate.toISOString(), seconds || null, kind === "course" ? a.distanceMeters || null : null, kind === "course" ? a.climbMeters : null, a.id],
    );
    if (rows.length > 0) {
      best.status = "done";
      best.activityId = a.id;
      checked++;
    }
  }
  return checked;
}

// --- Adaptation ----------------------------------------------------------------

export type Adjustment = { week: number; factor: number; reason: string };

/**
 * Décide l'ajustement d'une semaine d'après la précédente : séances
 * manquées, ressenti moyen, kilomètres réellement courus. Seuls le footing
 * et la sortie longue changent de durée ; les séances de qualité, le semi et
 * la course ne bougent pas.
 */
export function decideAdjustment(week: number, previous: PlanSession[]): Adjustment {
  const info = PLAN_WEEKS[week - 1];
  if (week === 1 || previous.length === 0) return { week, factor: 1, reason: "Première semaine : plan tel quel." };
  if (week >= PLAN_WEEKS.length - 1) return { week, factor: 1, reason: "Dernières semaines : le plan ne bouge plus." };

  const done = previous.filter((s) => s.status === "done");
  // Seules les sorties comptent comme manquées : un renfo fait sans être
  // noté ne doit pas alléger la semaine suivante.
  const runs = previous.filter((s) => s.kind === "course");
  const missed = runs.filter((s) => s.status !== "done").length;
  const feelings = done.map((s) => s.feeling).filter((f): f is number => f !== null);
  const feeling = feelings.length ? feelings.reduce((a, b) => a + b, 0) / feelings.length : null;
  const measured = done.filter((s) => s.kind === "course" && s.targetMeters && s.actualMeters);
  const ratio = measured.length ? measured.reduce((a, s) => a + (s.actualMeters ?? 0), 0) / measured.reduce((a, s) => a + (s.targetMeters ?? 0), 0) : null;

  let factor = 1;
  let reason = "Semaine conforme : plan inchangé.";
  if (missed >= 2) {
    factor = 0.8;
    reason = `${missed} sorties manquées la semaine dernière : on reprend en douceur, sans rattraper.`;
  } else if (feeling !== null && feeling <= 2 && feelings.length >= 2) {
    factor = 0.85;
    reason = "Semaine dernière ressentie comme dure : on allège footing et sortie longue.";
  } else if (missed === 1) {
    reason = "Une sortie manquée la semaine dernière : on ne la rattrape pas, on continue.";
  } else if (missed === 0 && feeling !== null && feeling >= 4.5 && feelings.length >= 3 && (ratio === null || ratio >= 0.95)) {
    factor = 1.05;
    reason = "Tout est passé facilement : footing et sortie longue un peu allongés.";
  }
  // Une semaine allégée le reste : on ne l'alourdit jamais.
  if (info.light && factor > 1) {
    factor = 1;
    reason = "Semaine allégée : elle le reste, même si tout va bien.";
  }
  return { week, factor, reason };
}

export async function listAdjustments(): Promise<Map<number, Adjustment>> {
  const rows = await query<{ week: number; factor: string | number; reason: string }>(`select week, factor, reason from plan_adjustments`);
  return new Map(rows.map((r) => [r.week, { week: r.week, factor: Number(r.factor), reason: r.reason }]));
}

/**
 * Ajustement de la semaine en cours. Il suit la semaine précédente tant
 * qu'aucune séance de la semaine n'est faite (le temps de noter les
 * dernières séances), puis il est figé.
 */
export async function ensureAdjustment(week: number, sessions: PlanSession[]): Promise<Adjustment> {
  const known = (await listAdjustments()).get(week);
  const started = sessions.some((s) => s.week === week && s.status === "done");
  if (known && started) return known;
  const decided = decideAdjustment(week, sessions.filter((s) => s.week === week - 1));
  if (known && known.factor === decided.factor && known.reason === decided.reason) return known;
  await query(
    `insert into plan_adjustments (week, factor, reason) values ($1, $2, $3)
     on conflict (week) do update set factor = excluded.factor, reason = excluded.reason, decided_at = now()`,
    [decided.week, decided.factor, decided.reason],
  );
  return decided;
}

const ADJUSTABLE = new Set(["Footing en endurance", "Sortie longue"]);

function roundMinutes(seconds: number): number {
  return Math.max(5, Math.round(seconds / 300) * 5);
}

function minutesLabel(total: number, unit = "′"): string {
  if (total < 60) return `${total}${unit}`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/** La séance telle qu'à faire, ajustement compris. */
export function withAdjustment(session: PlanSession, factor: number | undefined): PlanSession & { adjusted: boolean } {
  if (!factor || factor === 1 || session.status !== "todo" || !ADJUSTABLE.has(session.title)) return { ...session, adjusted: false };
  const total = roundMinutes(session.targetSeconds * factor);
  const rest = session.summary.split(" · ").slice(1);
  const long = session.title === "Sortie longue";
  return {
    ...session,
    adjusted: true,
    targetSeconds: total * 60,
    targetMeters: session.targetMeters ? Math.round((session.targetMeters * factor) / 100) * 100 : null,
    summary: [minutesLabel(total, " min"), ...rest].join(" · "),
    blocks: long
      ? session.blocks.map((b, i) => (i === 1 ? { ...b, duration: minutesLabel(total - 20) } : b))
      : session.blocks.map((b) => ({ ...b, duration: minutesLabel(total) })),
  };
}
