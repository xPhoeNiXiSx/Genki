import { query } from "@/lib/db";
import { PLAN_START, PLAN_WEEKS, RENFO_LEVELS, plannedSessions, type PlanBlock, type PlanKind, type PlanWeek } from "@/lib/plan-data";
import { RUN_TYPES, planKindOf, type Activity } from "@/lib/activities";
import { parisToday } from "@/lib/dates";
import { addDays, formOf } from "@/lib/stats";
import { listWellness } from "@/lib/wellness";

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
  const payload = [
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
  ];
  await query(
    `insert into plan_sessions (week, position, kind, title, summary, why, blocks, target_seconds, target_meters, target_climb)
     select s.week, s.position, s.kind, s.title, s.summary, s.why, s.blocks, s.target_seconds, s.target_meters, s.target_climb
       from json_to_recordset($1::json) as s(week smallint, position smallint, kind text, title text, summary text, why text,
            blocks jsonb, target_seconds integer, target_meters integer, target_climb integer)
     on conflict (week, position) do nothing`,
    payload,
  );
  // Un renfo pas encore fait suit le contenu actuel du plan (routine tibias
  // ajoutée en cours de route…). Les séances faites gardent leur historique.
  await query(
    `update plan_sessions p
        set blocks = s.blocks, summary = s.summary, target_seconds = s.target_seconds
       from json_to_recordset($1::json) as s(week smallint, position smallint, kind text, summary text, blocks jsonb, target_seconds integer)
      where p.week = s.week and p.position = s.position and p.kind = 'renfo' and s.kind = 'renfo'
        and p.status <> 'done' and (p.blocks <> s.blocks or p.summary <> s.summary or p.target_seconds <> s.target_seconds)`,
    payload,
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
 * Ce que la montre dit avant une semaine : volume couru les 4 semaines
 * d'avant, fraîcheur (forme − fatigue d'intervals.icu), et récup (VFC qui
 * baisse, FC au repos qui monte, sur 7 jours face aux 4 semaines d'avant).
 */
export type BodySignals = { recentKm: number | null; tsb: number | null; hrvDrop: boolean; restingRise: boolean };

const NO_SIGNALS: BodySignals = { recentKm: null, tsb: null, hrvDrop: false, restingRise: false };

/**
 * Décide l'ajustement d'une semaine d'après la précédente : séances
 * manquées, ressenti moyen, kilomètres réellement courus, puis ce que dit
 * la montre (fatigue, récup). La première semaine part du volume couru
 * juste avant le plan. Seuls le footing et la sortie longue changent de
 * durée ; les séances de qualité, le semi et la course ne bougent pas.
 */
export function decideAdjustment(week: number, previous: PlanSession[], signals: Partial<BodySignals> = {}): Adjustment {
  const info = PLAN_WEEKS[week - 1];
  const body = { ...NO_SIGNALS, ...signals };
  if (week >= PLAN_WEEKS.length - 1) return { week, factor: 1, reason: "Dernières semaines : le plan ne bouge plus." };

  let factor = 1;
  let reason = "Semaine conforme : plan inchangé.";
  if (week === 1 || previous.length === 0) {
    const recent = body.recentKm === null ? null : Math.round(body.recentKm);
    if (recent !== null && body.recentKm! < 0.7 * info.km) {
      factor = 0.85;
      reason = `Tu cours ≈ ${recent} km par semaine ces 4 dernières semaines : on démarre un peu plus court.`;
    } else {
      reason = recent !== null ? `≈ ${recent} km par semaine ces 4 dernières semaines : le plan démarre tel quel.` : "Première semaine : plan tel quel.";
    }
  } else {
    const done = previous.filter((s) => s.status === "done");
    // Seules les sorties comptent comme manquées : un renfo fait sans être
    // noté ne doit pas alléger la semaine suivante.
    const runs = previous.filter((s) => s.kind === "course");
    const missed = runs.filter((s) => s.status !== "done").length;
    const feelings = done.map((s) => s.feeling).filter((f): f is number => f !== null);
    const feeling = feelings.length ? feelings.reduce((a, b) => a + b, 0) / feelings.length : null;
    const measured = done.filter((s) => s.kind === "course" && s.targetMeters && s.actualMeters);
    const ratio = measured.length ? measured.reduce((a, s) => a + (s.actualMeters ?? 0), 0) / measured.reduce((a, s) => a + (s.targetMeters ?? 0), 0) : null;

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
  }

  // La montre a le dernier mot quand elle voit de la fatigue.
  const recoveryDown = body.hrvDrop || body.restingRise;
  if (factor > 1 && (recoveryDown || (body.tsb !== null && body.tsb < -10))) {
    factor = 1;
    reason = "Tout est passé facilement, mais la montre voit de la fatigue : on garde le plan tel quel.";
  }
  if (body.tsb !== null && body.tsb < -25 && factor > 0.85) {
    factor = 0.85;
    reason = `Fatigue accumulée (fraîcheur ${body.tsb}) : on allège footing et sortie longue.`;
  } else if (recoveryDown && factor > 0.9) {
    factor = 0.9;
    const what = [body.hrvDrop ? "VFC en baisse" : null, body.restingRise ? "FC au repos en hausse" : null].filter(Boolean).join(", ");
    reason = `Récup en baisse sur la montre (${what}) : footing et sortie longue un peu raccourcis.`;
  }

  // Une semaine allégée le reste : on ne l'alourdit jamais.
  if (info.light && factor > 1) {
    factor = 1;
    reason = "Semaine allégée : elle le reste, même si tout va bien.";
  }
  return { week, factor, reason };
}

/** Lit, dans les sorties et les données santé importées, ce que dit la montre avant une semaine du plan. */
export async function bodySignals(week: number, today = parisToday()): Promise<BodySignals> {
  // Avant la semaine, on regarde les jours déjà passés : des jours à venir
  // feraient baisser les moyennes à tort.
  const tomorrow = addDays(today, 1);
  const monday = PLAN_WEEKS[week - 1].monday < tomorrow ? PLAN_WEEKS[week - 1].monday : tomorrow;
  const [runs, wellness] = await Promise.all([
    query<{ meters: string | number | null; count: string | number }>(
      `select sum(distance_meters) as meters, count(*) as count from activities
        where sport_type = any($1::text[]) and (start_date at time zone 'Europe/Paris')::date between $2 and $3`,
      [[...RUN_TYPES], addDays(monday, -28), addDays(monday, -1)],
    ),
    listWellness(addDays(monday, -35), addDays(monday, -1)),
  ]);
  const count = Number(runs[0]?.count ?? 0);
  const form = formOf(wellness);
  const lastWeek = wellness.filter((d) => d.day >= addDays(monday, -7));
  const before = wellness.filter((d) => d.day < addDays(monday, -7));
  const avg = (list: (number | null)[]) => {
    const values = list.filter((v): v is number => v !== null);
    return values.length ? { mean: values.reduce((a, b) => a + b, 0) / values.length, n: values.length } : null;
  };
  const hrvNow = avg(lastWeek.map((d) => d.hrv));
  const hrvBase = avg(before.map((d) => d.hrv));
  const restNow = avg(lastWeek.map((d) => d.restingHr));
  const restBase = avg(before.map((d) => d.restingHr));
  const enough = (now: { n: number } | null, base: { n: number } | null) => now !== null && base !== null && now.n >= 4 && base.n >= 7;
  return {
    recentKm: count > 0 ? Number(runs[0].meters ?? 0) / 1000 / 4 : null,
    // Une fraîcheur de plus de 3 jours ne dit plus rien de la semaine.
    tsb: form && form.day >= addDays(monday, -3) ? form.tsb : null,
    hrvDrop: enough(hrvNow, hrvBase) && hrvNow!.mean < 0.9 * hrvBase!.mean,
    restingRise: enough(restNow, restBase) && restNow!.mean >= restBase!.mean + 5,
  };
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
  const decided = decideAdjustment(week, sessions.filter((s) => s.week === week - 1), await bodySignals(week).catch(() => NO_SIGNALS));
  if (known && known.factor === decided.factor && known.reason === decided.reason) return known;
  await query(
    `insert into plan_adjustments (week, factor, reason) values ($1, $2, $3)
     on conflict (week) do update set factor = excluded.factor, reason = excluded.reason, decided_at = now()`,
    [decided.week, decided.factor, decided.reason],
  );
  return decided;
}

export type RenfoLevel = { level: number; reason: string | null };

/**
 * Niveau du prochain renfo, rejoué depuis les renfos faits, dans l'ordre :
 * un renfo ressenti « bien » ou « facile » (4-5) fait monter d'un cran, un
 * renfo « dur » ou « très dur » (1-2) fait redescendre.
 */
export function renfoLevel(sessions: PlanSession[]): RenfoLevel {
  const done = sessions
    .filter((s) => s.kind === "renfo" && s.status === "done" && s.feeling !== null)
    .sort((a, b) => (a.doneAt?.getTime() ?? 0) - (b.doneAt?.getTime() ?? 0));
  let level = 1;
  let reason: string | null = null;
  for (const s of done) {
    if (s.feeling! >= 4 && level < RENFO_LEVELS) {
      level += 1;
      reason = "Le dernier renfo est passé facilement : un cran au-dessus.";
    } else if (s.feeling! <= 2 && level > 1) {
      level -= 1;
      reason = "Le dernier renfo était dur : un cran en dessous.";
    } else if (s.feeling! >= 4) {
      reason = "Niveau maximum : pour corser encore, un sac à dos chargé (3-5 kg) sur squats, fentes et montées.";
    }
  }
  return { level, reason };
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
