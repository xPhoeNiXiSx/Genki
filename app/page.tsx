import Link from "next/link";

import { parisToday } from "@/lib/dates";
import { formatLength } from "@/lib/duration";
import { getProgram, listPrograms } from "@/lib/programs";
import { dailyTotals } from "@/lib/workouts";

import { databaseBlocker } from "./db-screens";
import { Icon, type IconName } from "./ui/icons";
import { Lanes } from "./ui/lanes";
import { Logo } from "./ui/logo";
import { TabBar } from "./ui/tab-bar";
import { WeekSuns } from "./ui/week-suns";

const SHORTCUTS: { href: string; label: string; icon: IconName; style: string }[] = [
  { href: "/programmes", label: "Séances", icon: "list", style: "galet ink" },
  { href: "/exercices", label: "Exercices", icon: "dumbbell", style: "galet alt" },
  { href: "/metronome", label: "Métronome", icon: "metronome", style: "galet volt alt" },
  { href: "/suivi", label: "Suivi", icon: "chart", style: "galet" },
];

export default async function HomePage() {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;

  const [programs, days] = await Promise.all([listPrograms(), dailyTotals()]);
  const next = programs[0] ? await getProgram(programs[0].id) : null;
  const today = parisToday();
  const todayIndex = Math.max(0, days.findIndex((d) => d.day === today));
  const weekSeconds = days.reduce((sum, d) => sum + d.seconds, 0);
  const sessions = days.filter((d) => d.seconds > 0).length;
  const total = next ? next.steps.reduce((sum, s) => sum + s.durationSeconds, 0) : 0;

  return (
    <main className="screen">
      <Lanes />
      <Link href="/compte" className="round" aria-label="Réglages" style={{ position: "absolute", top: "calc(env(safe-area-inset-top) + 20px)", right: 24, zIndex: 2 }}>
        <Icon name="settings" size={20} />
      </Link>
      <p className="katakana under-button" aria-hidden="true">ゲンキ</p>

      <header>
        <Logo />
      </header>

      <h1 className="display" style={{ fontSize: 38, marginTop: 22 }}>Bonjour</h1>
      <p className="muted" style={{ margin: "4px 0 22px", fontSize: 16 }}>Prêt pour ta séance ?</p>

      <div style={{ position: "relative" }}>
        <article className="bib tilted">
          <div className="bib-band">
            <span className="label">{next ? "Séance du jour" : "Pas encore de séance"}</span>
          </div>
          <div className="bib-body" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, minHeight: 156 }}>
            {next ? (
              <>
                <div>
                  <h2 className="display" style={{ fontSize: 22, lineHeight: 1.12 }}>{next.name}</h2>
                  <p className="mono muted" style={{ margin: "8px 0 18px", fontSize: 13 }}>
                    {next.steps.length} étape{next.steps.length > 1 ? "s" : ""}
                  </p>
                  <Link href={`/seance/${next.id}`} className="btn">
                    <Icon name="play" size={16} /> Démarrer
                  </Link>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="display" style={{ fontSize: 72, lineHeight: 1 }}>
                    {Math.max(1, Math.round(total / 60))}’
                  </span>
                  <span className="mono muted" style={{ display: "block", fontSize: 12 }}>min</span>
                </div>
              </>
            ) : (
              <p style={{ margin: 0, alignSelf: "center" }}>
                Tes séances apparaîtront ici, prêts à lancer.
              </p>
            )}
          </div>
        </article>
        <span className="stamp" aria-hidden="true" style={{ position: "absolute", right: -8, top: -10 }}>始</span>
      </div>

      <h2 className="section">Raccourcis</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ display: "grid", gap: 12 }}>
          {[SHORTCUTS[0], SHORTCUTS[2]].map((s, i) => (
            <Link key={s.href} href={s.href} className={s.style} style={{ minHeight: i === 0 ? 98 : 76, display: "grid", alignContent: "space-between" }}>
              <span style={{ color: s.style.includes("ink") ? "var(--volt)" : undefined }}><Icon name={s.icon} /></span>
              <span style={{ fontWeight: 700, fontSize: 15, color: s.style.includes("ink") ? "var(--volt)" : undefined }}>{s.label}</span>
            </Link>
          ))}
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {[SHORTCUTS[1], SHORTCUTS[3]].map((s, i) => (
            <Link key={s.href} href={s.href} className={s.style} style={{ minHeight: i === 0 ? 76 : 98, display: "grid", alignContent: "space-between" }}>
              <Icon name={s.icon} />
              <span style={{ fontWeight: 700, fontSize: 15 }}>{s.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <h2 className="section">Cette semaine</h2>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <p className="display" style={{ fontSize: 28 }}>{weekSeconds > 0 ? formatLength(weekSeconds) : "0 min"}</p>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            {sessions} jour{sessions > 1 ? "s" : ""} d&apos;entraînement
          </p>
        </div>
        <WeekSuns seconds={days.map((d) => d.seconds)} today={todayIndex} />
      </div>

      <TabBar />
    </main>
  );
}
