import Link from "next/link";

import { parisToday } from "@/lib/dates";
import { currentWeek, daysToRace, ensureAdjustment, listAdjustments, listPlanSessions, matchActivities, weekProgress, withAdjustment, type PlanSession } from "@/lib/plan";
import { PHASES, PLAN_START, PLAN_WEEKS, RACE } from "@/lib/plan-data";
import { getStravaConnection, syncStrava } from "@/lib/strava";

import { databaseBlocker } from "../db-screens";
import { Icon } from "../ui/icons";
import { Lanes } from "../ui/lanes";
import { TabBar } from "../ui/tab-bar";
import { planLine, shortDate } from "./format";

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ semaine?: string }> }) {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;

  const today = parisToday();
  const now = currentWeek(today);
  const { semaine } = await searchParams;
  const asked = Number(semaine);
  const week = Number.isInteger(asked) && asked >= 1 && asked <= PLAN_WEEKS.length ? asked : now;

  await syncIfStale();
  const sessions = await listPlanSessions();
  const progress = weekProgress(sessions);
  const info = progress[week - 1];
  // L'ajustement de la semaine en cours se décide à la première visite.
  const adjustment = week === now ? await ensureAdjustment(now, sessions) : (await listAdjustments()).get(week);
  const list = sessions.filter((s) => s.week === week).map((s) => withAdjustment(s, adjustment?.factor));
  const kmDone = Math.round(info.metersDone / 100) / 10;
  const days = daysToRace(today, RACE.date);
  const sunday = new Date(`${info.monday}T12:00:00Z`);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const next = list.find((s) => s.status === "todo");

  return (
    <main className="screen">
      <Lanes />
      <p className="katakana" aria-hidden="true" style={{ fontSize: 40 }}>プラン</p>

      <h1 className="display title">Mon plan</h1>
      <p className="subtitle">けいかく · {RACE.name} {RACE.distanceKm} km</p>

      <article style={{ marginTop: 20, borderRadius: 26, overflow: "hidden", background: "var(--ink)", color: "var(--white)", transform: "rotate(-1.2deg)", boxShadow: "0 10px 24px rgba(26,26,29,.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", background: "var(--volt)", color: "var(--ink)" }}>
          <span className="mono" style={{ fontSize: 11, fontWeight: 500 }}>N° {String(RACE.distanceKm).padStart(3, "0")}</span>
          <span className="label" style={{ fontSize: 10 }}>Objectif · {RACE.goal}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 20px 20px" }}>
          <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
            <span className="display" style={{ fontSize: 20 }}>Samedi 20 mars</span>
            <span className="mono" style={{ fontSize: 11, opacity: 0.85 }}>{RACE.distanceKm} km · {RACE.climbM} m D+ · {RACE.route}</span>
            <div aria-hidden="true" style={{ display: "flex", gap: 3, marginTop: 8 }}>
              {PLAN_WEEKS.map((w) => (
                <span key={w.week} style={{ width: 8, height: 6, borderRadius: 3, background: w.week < now ? "rgba(255,255,255,.6)" : w.week === now ? "var(--volt)" : "rgba(255,255,255,.18)" }} />
              ))}
            </div>
          </div>
          <div style={{ display: "grid", justifyItems: "end" }}>
            <span className="display" style={{ fontSize: 30, lineHeight: 1, color: "var(--volt)", whiteSpace: "nowrap" }}>{days > 0 ? `J-${days}` : days === 0 ? "Jour J" : "Fini"}</span>
            <span className="mono" style={{ fontSize: 11, marginTop: 4 }}>sem. {now} / {PLAN_WEEKS.length}</span>
          </div>
        </div>
      </article>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 26 }}>
        <span className="label" style={{ color: "var(--grey)" }}>Phases</span>
        <Link href="/plan/semaines" className="mono" style={{ fontSize: 11 }}>voir les {PLAN_WEEKS.length} semaines ›</Link>
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
        {PHASES.map((phase) => {
          const weeks = PLAN_WEEKS.filter((w) => w.phase === phase);
          const on = info.phase === phase;
          return (
            <div key={phase} style={{ flex: `${weeks.length} 1 0`, minWidth: 0, padding: "10px 8px 10px 10px", borderRadius: 14, background: on ? "var(--volt)" : "var(--white)", border: on ? "1.5px solid var(--ink)" : "1px solid var(--line)" }}>
              <span style={{ display: "block", fontSize: 11, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{phase}</span>
              <span className="mono" style={{ fontSize: 10, color: on ? "var(--ink)" : "var(--grey)" }}>S{weeks[0].week}–{weeks.at(-1)!.week}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginTop: 28 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {week > 1 ? <Link href={`/plan?semaine=${week - 1}`} className="round" style={{ width: 32, height: 32 }} aria-label="Semaine précédente"><Icon name="back" size={16} /></Link> : null}
            <h2 className="display" style={{ fontSize: 22 }}>Semaine {week}</h2>
            {week < PLAN_WEEKS.length ? <Link href={`/plan?semaine=${week + 1}`} className="round" style={{ width: 32, height: 32 }} aria-label="Semaine suivante"><Icon name="chevron" size={16} /></Link> : null}
          </div>
          <p className="mono muted" style={{ margin: "6px 0 0", fontSize: 11 }}>
            {shortDate(info.monday)} → {shortDate(sunday.toISOString().slice(0, 10))} · {info.phase.toLowerCase()} · {info.km} km prévus
          </p>
        </div>
        <span className="mono" style={{ flex: "none", fontSize: 12, border: "1.5px solid var(--ink)", borderRadius: 14, padding: "4px 12px" }}>{info.done} / {info.total} faites</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--soft)", overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, (kmDone / info.km) * 100)}%`, height: 8, borderRadius: 4, background: "var(--ink)" }} />
        </div>
        <span className="mono muted" style={{ fontSize: 11 }}>{String(kmDone).replace(".", ",")} / {info.km} km</span>
      </div>

      {adjustment && adjustment.factor !== 1 ? (
        <p className="galet" style={{ margin: "12px 0 0", borderRadius: 18, padding: "10px 14px", fontSize: 13, lineHeight: 1.4, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span className="mono" style={{ flex: "none", fontWeight: 500, padding: "1px 8px", borderRadius: 8, background: adjustment.factor < 1 ? "var(--ink)" : "var(--volt)", color: adjustment.factor < 1 ? "var(--volt)" : "var(--ink)" }}>
            {adjustment.factor < 1 ? "−" : "+"}{Math.round(Math.abs(1 - adjustment.factor) * 100)} %
          </span>
          <span>{adjustment.reason}</span>
        </p>
      ) : null}

      <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
        {list.map((s) => <SessionCard key={s.id} session={s} next={s.id === next?.id && week === now} />)}
      </div>

      <div className="galet ink" style={{ marginTop: 12, borderRadius: 22, padding: "14px 18px", fontSize: 13, lineHeight: 1.45 }}>
        <strong style={{ color: "var(--volt)" }}>Conseil de la semaine</strong> — {info.tip}
      </div>

      <TabBar />
    </main>
  );
}

/**
 * Strava relié : les sorties récentes cochent le plan à l'ouverture, au plus
 * toutes les 30 minutes, sans jamais bloquer la page plus de 6 secondes.
 */
async function syncIfStale(): Promise<void> {
  const connection = await getStravaConnection().catch(() => null);
  if (!connection) return;
  if (connection.lastSyncAt && Date.now() - connection.lastSyncAt.getTime() < 30 * 60_000) return;
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 6000));
  await Promise.race([syncStrava(new Date(`${PLAN_START}T00:00:00Z`), matchActivities).catch(() => undefined), timeout]);
}

function SessionCard({ session: s, next }: { session: PlanSession & { adjusted?: boolean }; next: boolean }) {
  const done = s.status === "done";
  const skipped = s.status === "skipped";
  const background = next ? "var(--white)" : done ? "var(--stone)" : skipped ? "transparent" : "var(--white)";
  const border = next ? "1.5px solid var(--ink)" : done ? "1px solid var(--stone)" : skipped ? "1px dashed var(--line)" : "1px solid var(--line)";
  return (
    <Link href={`/plan/${s.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px 12px 14px", borderRadius: 22, background, border, opacity: skipped ? 0.6 : 1 }}>
      {done ? (
        <span aria-label="Faite" style={{ width: 30, height: 30, flex: "none", borderRadius: "50%", background: "var(--ink)", color: "var(--volt)", display: "grid", placeItems: "center" }}>
          <Icon name="check" size={16} strokeWidth={3} />
        </span>
      ) : skipped ? (
        <span aria-label="Pas faite" style={{ width: 30, height: 30, flex: "none", borderRadius: "50%", border: "1.5px solid var(--grey)", color: "var(--grey)", display: "grid", placeItems: "center" }}>
          <Icon name="close" size={14} />
        </span>
      ) : (
        <span aria-label="À faire" style={{ width: 30, height: 30, flex: "none", boxSizing: "border-box", borderRadius: "50%", border: "1.5px dashed rgba(26,26,29,.45)" }} />
      )}
      <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 3 }}>
        <span className="label" style={{ justifySelf: "start", padding: "2px 8px", borderRadius: 8, fontSize: 9, background: s.kind === "course" ? "var(--volt)" : "var(--ink)", color: s.kind === "course" ? "var(--ink)" : "var(--volt)" }}>
          {s.kind === "course" ? "Course" : "Renfo"}
        </span>
        <span style={{ fontWeight: 900, fontSize: 15, lineHeight: 1.2, textDecoration: skipped ? "line-through" : undefined }}>{s.title}</span>
        <span className="mono" style={{ fontSize: 11, color: done ? "var(--ink)" : "var(--grey)" }}>{done ? planLine(s) : s.summary}{s.adjusted ? " · ajustée" : ""}</span>
        {done ? <span className="muted" style={{ fontSize: 11 }}>prévu : {s.summary}</span> : null}
      </span>
      <Icon name="chevron" size={18} />
    </Link>
  );
}
