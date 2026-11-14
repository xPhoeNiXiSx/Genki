import Link from "next/link";

import { parisToday } from "@/lib/dates";
import { currentWeek, daysToRace, ensureAdjustment, listAdjustments, listPlanSessions, withAdjustment, type PlanSession } from "@/lib/plan";
import { PLAN_START, RACE } from "@/lib/plan-data";
import { listWatchDays } from "@/lib/plan-watch";
import { activeDays, addDays, formOf, mondayOf, weeklyVolume } from "@/lib/stats";
import { syncIfStale } from "@/lib/sync";
import { listWellness } from "@/lib/wellness";

import { databaseBlocker } from "./db-screens";
import { ReportSheet } from "./plan/[id]/report-sheet";
import { hoursMinutes, km, shortDate } from "./plan/format";
import { Icon } from "./ui/icons";
import { Lanes } from "./ui/lanes";
import { TabBar } from "./ui/tab-bar";

const WEEKDAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const LETTERS = ["L", "M", "M", "J", "V", "S", "D"];

const weekday = (iso: string) => WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
/** « mar. 8 déc ». */
const dayLabel = (iso: string) => `${weekday(iso)} ${shortDate(iso)}`;
/** Jour de Paris d'un instant. */
const parisDay = (date: Date) => parisToday(date);

/** Le résumé sans la durée en tête (« 45 min · 6:45–7:15 /km » → « 6:45–7:15 /km »), déjà affichée. */
const detail = (summary: string) => summary.split(" · ").filter((part, i) => i > 0 || !/^\d+\s*(min|h)/.test(part)).join(" · ");

type DayCell = { iso: string; letter: string; mark: string; state: "done" | "today" | "planned" | "free" };

export default async function TodayPage() {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;

  const today = parisToday();
  await syncIfStale(today);
  const started = today >= PLAN_START;
  const week = currentWeek(today);

  const sessions = await listPlanSessions();
  const adjustment = started ? await ensureAdjustment(week, sessions) : (await listAdjustments()).get(week);
  const adjusted = (s: PlanSession) => withAdjustment(s, s.week === week ? adjustment?.factor : undefined);
  const monday = mondayOf(today);
  const [watch, active, [volume], wellness] = await Promise.all([
    listWatchDays(),
    activeDays(monday, addDays(monday, 6)),
    weeklyVolume(today, 1),
    listWellness(addDays(today, -14), today),
  ]);

  // La séance du jour : celle envoyée à la montre pour aujourd'hui, sinon la
  // première à faire de la semaine (ou de la suite du plan).
  const todo = sessions.filter((s) => s.status === "todo");
  const main = todo.find((s) => watch.get(s.id) === today) ?? todo.find((s) => s.week === week) ?? todo.find((s) => s.week > week) ?? null;
  const session = main ? adjusted(main) : null;
  const next = main ? todo.find((s) => s !== main && (s.week > main.week || (s.week === main.week && s.position > main.position)) ) ?? null : null;
  const weekDone = !todo.some((s) => s.week === week);
  const sessionWatch = session ? watch.get(session.id) : undefined;

  const doneDays = new Set(sessions.filter((s) => s.status === "done" && s.doneAt).map((s) => parisDay(s.doneAt!)));
  const plannedDays = new Map<string, string>();
  for (const s of todo) {
    const day = watch.get(s.id);
    if (day) plannedDays.set(day, s.kind === "renfo" ? "renfo" : "course");
  }
  const cells: DayCell[] = LETTERS.map((letter, i) => {
    const iso = addDays(monday, i);
    const done = doneDays.has(iso) || active.has(iso);
    if (done) return { iso, letter, mark: "✓", state: "done" };
    if (iso === today) return { iso, letter, mark: "auj.", state: "today" };
    const planned = plannedDays.get(iso);
    if (planned) return { iso, letter, mark: planned, state: "planned" };
    return { iso, letter, mark: "", state: "free" };
  });

  const form = formOf(wellness);
  const days = daysToRace(today, RACE.date);
  const [, month, dayOfMonth] = today.split("-");
  const headline = started
    ? `${weekday(today).toUpperCase()} ${Number(dayOfMonth)}/${month} · SEMAINE ${week} / 16`
    : `${weekday(today).toUpperCase()} ${Number(dayOfMonth)}/${month} · LE PLAN DÉMARRE DANS ${daysToRace(today, PLAN_START)} J`;

  return (
    <main className="screen">
      <Lanes />
      <Link href="/compte" className="round" aria-label="Mon compte" style={{ position: "absolute", top: "calc(env(safe-area-inset-top) + 20px)", left: 24, zIndex: 2 }}>
        <Icon name="settings" size={20} />
      </Link>
      <p className="katakana" aria-hidden="true" style={{ fontSize: 44 }}>キョウ</p>

      <p className="mono muted" style={{ margin: "70px 0 0", fontSize: 12 }}>{headline}</p>
      <h1 className="display" style={{ fontSize: 34, marginTop: 6 }}>Aujourd’hui</h1>

      {session ? (
        <article className="bib" style={{ marginTop: 18, borderRadius: 26, overflow: "hidden", border: "1.5px solid var(--ink)", transform: "rotate(-1deg)", boxShadow: "0 10px 24px rgba(26,26,29,.12)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "10px 20px", background: "var(--volt)" }}>
            <span className="label" style={{ fontSize: 10 }}>
              {!started ? "Première séance" : weekDone ? "Semaine bouclée · ensuite" : sessionWatch === today ? "Séance du jour" : "À faire"} · {session.kind === "course" ? "course" : "renfo"}
            </span>
            {sessionWatch ? <span className="mono" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{sessionWatch === today ? "sur la montre ✓" : `montre · ${weekday(sessionWatch)}`}</span> : null}
          </div>
          <div style={{ padding: "16px 20px 20px", display: "grid", gap: 6 }}>
            <h2 className="display" style={{ fontSize: 24 }}>{session.title}</h2>
            <span className="mono muted" style={{ fontSize: 12 }}>
              {[hoursMinutes(session.targetSeconds), session.targetMeters ? `≈ ${km(session.targetMeters)}` : null, session.targetClimb ? `${session.targetClimb} m D+` : null].filter(Boolean).join(" · ")}
            </span>
            {detail(session.summary) ? <span className="muted" style={{ fontSize: 13 }}>{detail(session.summary)}</span> : null}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.3fr)", gap: 8, marginTop: 12 }}>
              <Link href={`/plan/${session.id}`} className="btn" style={{ height: 56, borderRadius: 28, background: "transparent", color: "var(--ink)", border: "1.5px solid var(--ink)" }}>Détail</Link>
              <ReportSheet session={session} label="Je l'ai faite" />
            </div>
          </div>
        </article>
      ) : (
        <div className="galet ink" style={{ marginTop: 18, borderRadius: 26, fontSize: 15 }}>
          <strong style={{ color: "var(--volt)" }}>Plan terminé.</strong> Toutes les séances sont passées : place à la course !
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 28 }}>
        <span className="label muted">Ma semaine</span>
        <span className="mono" style={{ fontSize: 11 }}>{volume.plannedKm ? `${String(volume.km).replace(".", ",")} / ${volume.plannedKm} km` : `${String(volume.km).replace(".", ",")} km`}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6, marginTop: 10 }}>
        {cells.map((c) => (
          <div
            key={c.iso}
            aria-label={`${dayLabel(c.iso)} : ${c.state === "done" ? "fait" : c.state === "today" ? "aujourd'hui" : c.state === "planned" ? `${c.mark} prévue` : "libre"}`}
            style={{
              height: 58,
              boxSizing: "border-box",
              borderRadius: 16,
              display: "grid",
              placeContent: "center",
              justifyItems: "center",
              gap: 4,
              background: c.state === "done" ? "var(--ink)" : c.state === "today" ? "var(--volt)" : c.state === "planned" ? "var(--white)" : "transparent",
              color: c.state === "done" ? "var(--volt)" : c.state === "free" ? "var(--grey)" : "var(--ink)",
              border: c.state === "today" ? "1.5px solid var(--ink)" : c.state === "planned" ? "1px solid var(--line)" : c.state === "free" ? "1px dashed rgba(26,26,29,.25)" : 0,
              outline: c.iso === today && c.state === "done" ? "2px solid var(--volt)" : undefined,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700 }}>{c.letter}</span>
            <span className="mono" style={{ fontSize: 10, minHeight: 12 }}>{c.mark}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 20 }}>
        <Link href="/plan" className="galet ink" style={{ borderRadius: 22, display: "grid", gap: 4 }}>
          <span className="label" style={{ fontSize: 10, color: "var(--volt)" }}>{RACE.name.replace(" Paris", "")}</span>
          <span className="display" style={{ fontSize: 28 }}>J-{days}</span>
          <span className="mono" style={{ fontSize: 11, opacity: 0.8 }}>sam. {shortDate(RACE.date)}</span>
        </Link>
        <Link href="/stats" className="galet" style={{ borderRadius: 22, display: "grid", gap: 4 }}>
          <span className="label muted" style={{ fontSize: 10 }}>Forme</span>
          {form ? (
            <>
              <span className="display" style={{ fontSize: 28 }}>
                {form.ctl}
                {form.ctlWeekAgo !== null ? <span style={{ fontSize: 14 }}> {form.ctl > form.ctlWeekAgo ? "↗" : form.ctl < form.ctlWeekAgo ? "↘" : "→"}</span> : null}
              </span>
              <span className="mono muted" style={{ fontSize: 11 }}>fraîcheur {form.tsb > 0 ? `+${form.tsb}` : form.tsb}</span>
            </>
          ) : (
            <>
              <span className="display" style={{ fontSize: 28 }}>—</span>
              <span className="mono muted" style={{ fontSize: 11 }}>voir mes stats</span>
            </>
          )}
        </Link>
      </div>

      {next ? (
        <>
          <span className="label muted" style={{ display: "block", marginTop: 26 }}>Ensuite</span>
          <Link href={`/plan/${next.id}`} style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12, padding: "12px 16px 12px 14px", borderRadius: 22, background: "var(--white)", border: "1px solid var(--line)" }}>
            <span style={{ width: 30, height: 30, flex: "none", boxSizing: "border-box", borderRadius: "50%", border: "1.5px dashed rgba(26,26,29,.45)" }} />
            <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 2 }}>
              <strong style={{ fontSize: 15 }}>{next.title}</strong>
              <span className="mono muted" style={{ fontSize: 11 }}>
                {[watch.get(next.id) ? weekday(watch.get(next.id)!) : next.week !== week ? `S${next.week}` : null, hoursMinutes(adjusted(next).targetSeconds)].filter(Boolean).join(" · ")}
              </span>
            </span>
            <Icon name="chevron" size={18} />
          </Link>
        </>
      ) : null}

      <TabBar />
    </main>
  );
}
