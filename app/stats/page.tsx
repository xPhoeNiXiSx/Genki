import Link from "next/link";

import { parisToday } from "@/lib/dates";
import { getIntervalsConnection } from "@/lib/intervals";
import { addDays, formOf, freshnessText, paceGroups, paceLabel, planTotals, recoveryOf, weeklyVolume } from "@/lib/stats";
import { syncIfStale } from "@/lib/sync";
import { listWellness } from "@/lib/wellness";

import { databaseBlocker } from "../db-screens";
import { hoursMinutes } from "../plan/format";
import { Lanes } from "../ui/lanes";
import { TabBar } from "../ui/tab-bar";

const SECTION = { marginTop: 24, display: "block" } as const;

/** « il y a 12 min », « il y a 3 h », « le 12 nov ». */
function since(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 24 * 60) return `il y a ${Math.round(minutes / 60)} h`;
  return `le ${new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short" }).format(date)}`;
}

const kmLabel = (km: number) => String(km).replace(".", ",");

export default async function StatsPage() {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;

  const today = parisToday();
  await syncIfStale(today);
  const [connection, weeks, paces, totals, wellness] = await Promise.all([
    getIntervalsConnection(),
    weeklyVolume(today),
    paceGroups(today),
    planTotals(),
    listWellness(addDays(today, -30), today),
  ]);
  const form = formOf(wellness);
  const recovery = recoveryOf(wellness);
  const thisWeek = weeks.at(-1)!;
  const max = Math.max(10, ...weeks.map((w) => Math.max(w.km, w.plannedKm)));
  const chartHeight = 110;

  const recoveryTiles = [
    { name: "FC repos", value: recovery.restingHr !== null ? String(recovery.restingHr) : "—", sub: "bpm" },
    { name: "VFC", value: recovery.hrv !== null ? String(Math.round(recovery.hrv)) : "—", sub: recovery.hrvAvg !== null ? `ms · moy. 7 j ${recovery.hrvAvg}` : "ms" },
    { name: "Sommeil", value: recovery.sleepSecs !== null ? hoursMinutes(recovery.sleepSecs) : "—", sub: "moy. 7 nuits" },
    { name: "VO2max", value: recovery.vo2max !== null ? String(Math.round(recovery.vo2max)) : "—", sub: "estimée par la montre" },
  ];
  const noRecovery = recoveryTiles.every((t) => t.value === "—");

  return (
    <main className="screen">
      <Lanes />
      <p className="katakana" aria-hidden="true" style={{ fontSize: 40 }}>トウケイ</p>

      <h1 className="display title">Mes stats</h1>
      <p className="mono muted" style={{ margin: "6px 0 0", fontSize: 12, paddingRight: 64 }}>
        {connection ? `Garmin · via intervals.icu · ${connection.lastSyncAt ? since(connection.lastSyncAt) : "pas encore synchronisé"}` : "intervals.icu n'est pas relié"}
      </p>

      {!connection ? (
        <Link href="/compte" className="galet ink" style={{ marginTop: 18, borderRadius: 22, display: "block", fontSize: 14, lineHeight: 1.45 }}>
          <strong style={{ color: "var(--volt)" }}>Relie intervals.icu</strong> dans Mon compte : tes sorties et les données de ta montre Garmin arriveront ici.
        </Link>
      ) : null}

      <span className="label muted" style={SECTION}>Volume</span>
      <div style={{ marginTop: 8, padding: 18, borderRadius: 26, background: "var(--white)", border: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span className="display" style={{ fontSize: 36, lineHeight: 1 }}>{kmLabel(thisWeek.km)}</span>
          <span className="mono muted" style={{ fontSize: 12 }}>km cette semaine{thisWeek.plannedKm ? ` · ${thisWeek.plannedKm} prévus` : ""}</span>
        </div>
        <svg role="img" aria-label={`Kilomètres par semaine sur 8 semaines : ${weeks.map((w) => `${w.label} ${kmLabel(w.km)} km`).join(", ")}`} viewBox="0 0 300 130" style={{ width: "100%", height: 130, marginTop: 12 }}>
          {weeks.map((w, i) => {
            const x = 6 + i * 37;
            const planned = Math.round((w.plannedKm / max) * chartHeight);
            const done = Math.round((w.km / max) * chartHeight);
            return (
              <g key={w.monday}>
                {planned > 0 ? <rect x={x} y={chartHeight - planned} width={24} height={planned} rx={6} fill="none" stroke="#1A1A1D" strokeOpacity={0.35} strokeDasharray="3 3" /> : null}
                {done > 0 ? <rect x={x} y={chartHeight - done} width={24} height={done} rx={6} fill={w.current ? "#D7FF3E" : "#1A1A1D"} stroke={w.current ? "#1A1A1D" : "none"} strokeWidth={1.5} /> : null}
                <text x={x + 12} y={128} textAnchor="middle" fontFamily="DM Mono, monospace" fontSize={10} fill="#64635B">{w.label}</text>
              </g>
            );
          })}
        </svg>
        <div className="mono muted" style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 11 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--ink)" }} />réalisé</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, boxSizing: "border-box", borderRadius: 3, border: "1px dashed var(--ink)" }} />prévu</span>
        </div>
      </div>

      <span className="label muted" style={SECTION}>Forme</span>
      {form ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 8 }}>
            <div className="stat volt" style={{ minHeight: 0, gap: 4 }}>
              <span className="label" style={{ fontSize: 10 }}>Forme</span>
              <span className="display" style={{ fontSize: 26 }}>{form.ctl}</span>
              <span className="mono" style={{ fontSize: 10 }}>{form.ctlWeekAgo !== null ? `${form.ctl - form.ctlWeekAgo >= 0 ? "+" : ""}${form.ctl - form.ctlWeekAgo} en 7 j` : "6 semaines"}</span>
            </div>
            <div className="stat" style={{ minHeight: 0, gap: 4 }}>
              <span className="label muted" style={{ fontSize: 10 }}>Fatigue</span>
              <span className="display" style={{ fontSize: 26 }}>{form.atl}</span>
              <span className="mono muted" style={{ fontSize: 10 }}>7 derniers j</span>
            </div>
            <div className="stat" style={{ minHeight: 0, gap: 4 }}>
              <span className="label muted" style={{ fontSize: 10 }}>Fraîcheur</span>
              <span className="display" style={{ fontSize: 26 }}>{form.tsb > 0 ? `+${form.tsb}` : form.tsb}</span>
              <span className="mono muted" style={{ fontSize: 10 }}>forme − fatigue</span>
            </div>
          </div>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.45 }}>
            Fraîcheur {form.tsb > 0 ? `+${form.tsb}` : form.tsb} : {freshnessText(form.tsb)}. La forme monte avec la régularité, pas avec une grosse séance.
          </p>
        </>
      ) : (
        <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>Pas encore de forme calculée : intervals.icu la déduit de tes sorties.</p>
      )}

      <span className="label muted" style={SECTION}>Allures · 4 dernières semaines</span>
      <div className="settings" style={{ marginTop: 8 }}>
        {paces.map((p) => (
          <div key={p.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 18px" }}>
            <span style={{ display: "grid", gap: 2 }}>
              <strong style={{ fontSize: 14 }}>{p.name}</strong>
              <span className="mono muted" style={{ fontSize: 11 }}>
                {p.runs === 0
                  ? "aucune sortie"
                  : [`${p.runs} sortie${p.runs > 1 ? "s" : ""}`, p.avgHr ? `FC moy. ${p.avgHr}` : null, p.name === "Sortie longue" && p.longestKm ? `max ${kmLabel(p.longestKm)} km` : null].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="display" style={{ fontSize: 18, whiteSpace: "nowrap" }}>{p.secondsPerKm ? paceLabel(p.secondsPerKm) : "—"}</span>
          </div>
        ))}
      </div>

      <span className="label muted" style={SECTION}>Récup · montre</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 8 }}>
        {recoveryTiles.map((t) => (
          <div key={t.name} className="stat" style={{ minHeight: 0, gap: 4 }}>
            <span className="label muted" style={{ fontSize: 10 }}>{t.name}</span>
            <span className="display" style={{ fontSize: 24 }}>{t.value}</span>
            <span className="mono muted" style={{ fontSize: 10 }}>{t.sub}</span>
          </div>
        ))}
      </div>
      {noRecovery && connection ? (
        <p className="muted" style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.45 }}>Rien reçu de la montre : dans intervals.icu, Settings → Garmin, active l&apos;import des données santé (wellness).</p>
      ) : null}

      <span className="label muted" style={SECTION}>Depuis le début du plan</span>
      <div className="galet ink" style={{ marginTop: 8, borderRadius: 22, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
        {[
          { name: "km courus", value: kmLabel(totals.km) },
          { name: "séances faites", value: `${totals.done} / ${totals.total}` },
          { name: "m de D+", value: String(totals.climb) },
          { name: "de course", value: totals.seconds ? hoursMinutes(totals.seconds) : "0 min" },
        ].map((t) => (
          <span key={t.name} style={{ display: "grid", gap: 2 }}>
            <span className="display" style={{ fontSize: 22, color: "var(--volt)" }}>{t.value}</span>
            <span className="mono" style={{ fontSize: 11, opacity: 0.8 }}>{t.name}</span>
          </span>
        ))}
      </div>

      <TabBar />
    </main>
  );
}
