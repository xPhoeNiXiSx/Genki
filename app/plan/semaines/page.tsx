import Link from "next/link";

import { parisToday } from "@/lib/dates";
import { currentWeek, listPlanSessions, weekProgress } from "@/lib/plan";
import { PLAN_WEEKS } from "@/lib/plan-data";

import { databaseBlocker } from "../../db-screens";
import { Icon } from "../../ui/icons";
import { Lanes } from "../../ui/lanes";
import { shortDate } from "../format";

export default async function PlanWeeksPage() {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;

  const now = currentWeek(parisToday());
  const weeks = weekProgress(await listPlanSessions());
  const total = PLAN_WEEKS.reduce((sum, w) => sum + w.km, 0);
  const peak = Math.max(...PLAN_WEEKS.map((w) => w.km));

  return (
    <main className="screen bare">
      <Lanes />
      <div className="top-bar">
        <Link href="/plan" className="round" aria-label="Retour au plan"><Icon name="back" size={20} /></Link>
        <span className="mono" style={{ fontSize: 12, border: "1.5px solid var(--ink)", borderRadius: 14, padding: "4px 12px" }}>≈ {total} km d&apos;entraînement</span>
      </div>
      <h1 className="display" style={{ fontSize: 30, marginTop: 18 }}>{PLAN_WEEKS.length} semaines jusqu&apos;au 20 mars</h1>
      <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
        3 sorties + 2 renfos par semaine, une semaine allégée toutes les 4. Peu de dénivelé autour : côtes en boucle, escaliers et renfo des descentes.
      </p>

      <div className="mono muted" style={{ display: "grid", gridTemplateColumns: "34px minmax(0, 1fr) 72px", columnGap: 10, marginTop: 16, padding: "0 12px", fontSize: 10 }}>
        <span>sem.</span>
        <span>séances faites · km prévus</span>
        <span style={{ textAlign: "right" }}>volume</span>
      </div>

      <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
        {weeks.map((w, i) => {
          const current = w.week === now;
          const phaseStart = i === 0 || weeks[i - 1].phase !== w.phase;
          return (
            <div key={w.week} style={{ display: "grid", gap: 4 }}>
              {phaseStart ? <p className="label" style={{ margin: "10px 0 2px" }}>{w.phase}</p> : null}
              <Link
                href={`/plan?semaine=${w.week}`}
                style={{ display: "grid", gridTemplateColumns: "34px minmax(0, 1fr) 72px", columnGap: 10, alignItems: "center", padding: "8px 12px", borderRadius: 16, background: current ? "var(--volt)" : w.light ? "var(--stone)" : "var(--white)", border: current ? "1.5px solid var(--ink)" : w.light ? "1px solid var(--stone)" : "1px solid var(--line)" }}
              >
                <span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>S{w.week}</span>
                <span style={{ minWidth: 0, display: "grid" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.title}</span>
                  <span className="mono" style={{ fontSize: 10, color: current ? "var(--ink)" : "var(--grey)" }}>
                    {shortDate(w.monday)} · {w.done}/{w.total} faites · {w.km} km
                  </span>
                </span>
                <span aria-hidden="true" style={{ height: 8, borderRadius: 4, background: "var(--soft)", overflow: "hidden" }}>
                  <span style={{ display: "block", height: 8, borderRadius: 4, width: `${Math.round((w.km / peak) * 100)}%`, background: w.light && !current ? "var(--grey)" : "var(--ink)" }} />
                </span>
              </Link>
            </div>
          );
        })}
      </div>
    </main>
  );
}
