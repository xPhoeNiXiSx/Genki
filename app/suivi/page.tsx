import Link from "next/link";

import { dayAndDate, parisToday } from "@/lib/dates";
import { formatLength } from "@/lib/duration";
import { dailyTotals, listWorkouts, weeklyTotals } from "@/lib/workouts";

import { databaseBlocker } from "../db-screens";
import { Lanes } from "../ui/lanes";
import { TabBar } from "../ui/tab-bar";
import { WeekSuns } from "../ui/week-suns";

/** Numéro de semaine ISO, pour l'étiquette « S41 ». */
function isoWeek(day: string): number {
  const date = new Date(`${day}T12:00:00Z`);
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((thursday.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

export default async function TrackingPage() {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;

  const [days, weeks, history] = await Promise.all([dailyTotals(), weeklyTotals(8), listWorkouts(20)]);
  const today = parisToday();
  const week = weeks[0];
  const max = Math.max(...weeks.map((w) => w.seconds), 1);

  return (
    <main className="screen">
      <Lanes />
      <h1 className="display title">Suivi</h1>
      <p className="subtitle">きろく · le carnet de séances</p>

      <section className="galet" style={{ borderRadius: 28, marginTop: 22, display: "grid", gap: 14 }}>
        <div>
          <p className="label" style={{ margin: 0, opacity: 0.7 }}>Cette semaine</p>
          <p className="display" style={{ fontSize: 38, marginTop: 4 }}>{week.seconds > 0 ? formatLength(week.seconds) : "0 min"}</p>
          <p className="mono muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
            {week.sessions} séance{week.sessions > 1 ? "s" : ""}
          </p>
        </div>
        <WeekSuns seconds={days.map((d) => d.seconds)} today={Math.max(0, days.findIndex((d) => d.day === today))} gap={44} />
      </section>

      <h2 className="section">8 dernières semaines</h2>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {[...weeks].reverse().map((w, i, list) => {
          const current = i === list.length - 1;
          const size = 10 + 30 * Math.sqrt(w.seconds / max);
          return (
            <div key={w.week} style={{ display: "grid", justifyItems: "center", gap: 8 }} title={formatLength(w.seconds)}>
              <div style={{ height: 42, display: "grid", placeItems: "center" }}>
                <span
                  style={{
                    width: size,
                    height: size,
                    borderRadius: "50%",
                    background: current ? "var(--volt)" : "var(--ink)",
                    opacity: current ? 1 : w.seconds > 0 ? 0.2 + 0.75 * (w.seconds / max) : 0.12,
                    border: current ? "1.5px solid var(--ink)" : undefined,
                  }}
                />
              </div>
              <span className="mono" style={{ fontSize: 10, color: current ? "var(--ink)" : "var(--grey)" }}>S{isoWeek(w.week)}</span>
            </div>
          );
        })}
      </div>

      <h2 className="section">Historique</h2>
      <div style={{ display: "grid", gap: 8 }}>
        {history.map((w) => {
          const [day, date] = dayAndDate(w.startedAt);
          return (
            <Link key={w.id} href={`/suivi/${w.id}`} style={{ display: "grid", gridTemplateColumns: "66px 1fr auto", alignItems: "center", gap: 14, background: "var(--white)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", paddingRight: 14 }}>
              <div style={{ background: w.completed ? "var(--ink)" : "var(--soft)", color: w.completed ? "var(--white)" : "var(--ink)", alignSelf: "stretch", display: "grid", placeContent: "center", textAlign: "center", padding: "12px 0" }}>
                <span className="mono" style={{ fontSize: 11, color: w.completed ? "var(--volt)" : undefined }}>{day}</span>
                <span className="mono" style={{ fontSize: 14 }}>{date}</span>
              </div>
              <div style={{ minWidth: 0, padding: "12px 0" }}>
                <p style={{ margin: 0, fontWeight: 900, fontSize: 15 }}>{w.programName}</p>
                <p className="mono muted" style={{ margin: "4px 0 0", fontSize: 11 }}>{formatLength(w.durationSeconds)}</p>
              </div>
              <span className="chip" style={{ height: 26, fontSize: 11, background: w.completed ? "var(--volt)" : "transparent", borderColor: w.completed ? "var(--ink)" : undefined }}>
                {w.completed ? "Terminée" : "Interrompue"}
              </span>
            </Link>
          );
        })}
        {history.length === 0 ? (
          <div className="galet" style={{ borderStyle: "dashed", textAlign: "center" }}>Aucune séance enregistrée.</div>
        ) : null}
      </div>

      <TabBar />
    </main>
  );
}
