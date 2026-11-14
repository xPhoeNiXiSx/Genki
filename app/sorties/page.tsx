import Link from "next/link";

import { listActivities, planKindOf, type ActivityRow } from "@/lib/activities";
import { parisToday } from "@/lib/dates";
import { getIntervalsConnection } from "@/lib/intervals";
import { addDays, mondayOf, paceLabel } from "@/lib/stats";
import { IMPORTED_WEEKS, syncIfStale } from "@/lib/sync";

import { databaseBlocker } from "../db-screens";
import { hoursMinutes, shortDate } from "../plan/format";
import { Lanes } from "../ui/lanes";
import { TabBar } from "../ui/tab-bar";

const WEEKDAYS = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];
const FILTERS = [
  { key: "tout", label: "Tout" },
  { key: "course", label: "Course" },
  { key: "renfo", label: "Renfo" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

const kmLabel = (meters: number) => String(Math.round(meters / 100) / 10).replace(".", ",");

/** « 45 min · 6:52 /km · +10 m · FC 138 ». */
function line(a: ActivityRow): string {
  const run = planKindOf(a.sportType) === "course";
  return [
    a.movingSeconds ? hoursMinutes(a.movingSeconds) : null,
    run && a.distanceMeters > 0 && a.movingSeconds ? paceLabel(Math.round(a.movingSeconds / (a.distanceMeters / 1000))) : null,
    run && a.climbMeters ? `+${a.climbMeters} m` : null,
    a.avgHr ? `FC ${a.avgHr}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function weekTitle(monday: string, today: string): string {
  const current = mondayOf(today);
  if (monday === current) return "Cette semaine";
  if (monday === addDays(current, -7)) return "Semaine dernière";
  return `${shortDate(monday)} → ${shortDate(addDays(monday, 6))}`;
}

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<{ type?: string; semaines?: string }> }) {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;

  const today = parisToday();
  await syncIfStale(today);
  const params = await searchParams;
  const filter: Filter = params.type === "course" || params.type === "renfo" ? params.type : "tout";
  const weeks = Math.min(IMPORTED_WEEKS, Math.max(8, Number(params.semaines) || 8));
  const since = addDays(mondayOf(today), -7 * (weeks - 1));
  const [connection, all] = await Promise.all([getIntervalsConnection(), listActivities(since)]);
  const list = all.filter((a) => filter === "tout" || planKindOf(a.sportType) === filter);

  const groups: { monday: string; items: ActivityRow[] }[] = [];
  for (const a of list) {
    const monday = mondayOf(a.day);
    const group = groups.at(-1)?.monday === monday ? groups.at(-1)! : (groups.push({ monday, items: [] }), groups.at(-1)!);
    group.items.push(a);
  }
  const href = (type: Filter, semaines = weeks) => `/sorties?${new URLSearchParams({ ...(type !== "tout" ? { type } : {}), ...(semaines !== 8 ? { semaines: String(semaines) } : {}) })}`;

  return (
    <main className="screen">
      <Lanes />
      <p className="katakana" aria-hidden="true" style={{ fontSize: 44 }}>ハシリ</p>

      <h1 className="display title">Mes sorties</h1>
      <p className="mono muted" style={{ margin: "6px 0 0", fontSize: 12, paddingRight: 64 }}>
        {connection ? "Garmin · via intervals.icu" : "intervals.icu n'est pas relié"}
      </p>

      <nav aria-label="Filtrer les sorties" style={{ display: "flex", gap: 8, marginTop: 18 }}>
        {FILTERS.map((f) => (
          <Link key={f.key} href={href(f.key)} className={filter === f.key ? "chip on" : "chip"} aria-current={filter === f.key ? "page" : undefined}>
            {f.label}
          </Link>
        ))}
      </nav>

      {!connection ? (
        <Link href="/compte" className="galet ink" style={{ marginTop: 18, borderRadius: 22, display: "block", fontSize: 14, lineHeight: 1.45 }}>
          <strong style={{ color: "var(--volt)" }}>Relie intervals.icu</strong> dans Mon compte : tes sorties Garmin arriveront ici.
        </Link>
      ) : groups.length === 0 ? (
        <p className="muted" style={{ marginTop: 22, fontSize: 14 }}>Aucune sortie sur ces {weeks} semaines.</p>
      ) : null}

      {groups.map((g) => {
        const meters = g.items.filter((a) => planKindOf(a.sportType) === "course").reduce((s, a) => s + a.distanceMeters, 0);
        const seconds = g.items.reduce((s, a) => s + a.movingSeconds, 0);
        return (
          <section key={g.monday}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginTop: 24 }}>
              <h2 className="label muted" style={{ margin: 0 }}>{weekTitle(g.monday, today)}</h2>
              <span className="mono" style={{ fontSize: 11 }}>{[meters ? `${kmLabel(meters)} km` : null, seconds ? hoursMinutes(seconds) : null].filter(Boolean).join(" · ")}</span>
            </div>
            <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "grid", gap: 8 }}>
              {g.items.map((a) => {
                const date = new Date(`${a.day}T12:00:00Z`);
                const run = planKindOf(a.sportType) === "course" && a.distanceMeters > 0;
                return (
                  <li key={a.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 16px 12px 12px", borderRadius: 22, background: "var(--white)", border: "1px solid var(--line)" }}>
                    <span style={{ width: 44, flex: "none", display: "grid", justifyItems: "center", gap: 2 }}>
                      <span className="mono muted" style={{ fontSize: 10 }}>{WEEKDAYS[date.getUTCDay()]}</span>
                      <span className="display" style={{ fontSize: 20, lineHeight: 1 }}>{date.getUTCDate()}</span>
                    </span>
                    <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 3 }}>
                      <strong style={{ fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</strong>
                      <span className="mono" style={{ fontSize: 11 }}>{line(a)}</span>
                      {a.planTitle ? (
                        <span style={{ justifySelf: "start", padding: "2px 8px", borderRadius: 8, background: "var(--volt)", fontSize: 10, fontWeight: 700 }}>✓ {a.planTitle}</span>
                      ) : null}
                    </span>
                    <span style={{ flex: "none", display: "grid", justifyItems: "end", gap: 2 }}>
                      <span className="display" style={{ fontSize: 18, lineHeight: 1 }}>{run ? kmLabel(a.distanceMeters) : Math.max(1, Math.round(a.movingSeconds / 60))}</span>
                      <span className="mono muted" style={{ fontSize: 10 }}>{run ? "km" : "min"}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {connection && weeks < IMPORTED_WEEKS ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <Link href={href(filter, Math.min(IMPORTED_WEEKS, weeks + 8))} className="btn" style={{ height: 44, padding: "0 20px", borderRadius: 22, background: "transparent", color: "var(--ink)", border: "1.5px dashed rgba(26,26,29,.45)" }}>
            Voir les semaines d’avant
          </Link>
        </div>
      ) : null}

      <TabBar />
    </main>
  );
}
