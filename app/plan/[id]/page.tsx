import Link from "next/link";
import { notFound } from "next/navigation";

import { bestView } from "@/lib/anatomy";
import { planExerciseLinks, type PlanExerciseLink } from "@/lib/plan-exercises";
import { glossaryFor } from "@/lib/plan-glossary";
import { getPlanSession, listAdjustments, listPlanSessions, withAdjustment } from "@/lib/plan";

import { databaseBlocker } from "../../db-screens";
import { BodyMap } from "../../ui/body-map";
import { ConfirmDelete } from "../../ui/confirm-delete";
import { Icon } from "../../ui/icons";
import { Lanes } from "../../ui/lanes";
import { setPlanStatusAction } from "../actions";
import { hoursMinutes, km, planLine } from "../format";
import { ReportSheet } from "./report-sheet";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PlanSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;

  const { id } = await params;
  const stored = UUID.test(id) ? await getPlanSession(id) : null;
  if (!stored) notFound();
  const adjustment = (await listAdjustments()).get(stored.week);
  const session = withAdjustment(stored, adjustment?.factor);
  const links = session.kind === "renfo" ? await planExerciseLinks() : new Map<string, PlanExerciseLink>();
  const glossary = glossaryFor([session.title, session.summary, ...session.blocks.flatMap((b) => [b.label, b.detail])]);
  const count = (await listPlanSessions()).filter((s) => s.week === session.week).length;

  const stats: { label: string; value: string }[] = [
    { label: "Durée", value: hoursMinutes(session.targetSeconds) },
    ...(session.targetMeters ? [{ label: "Distance", value: `≈ ${km(session.targetMeters)}` }] : []),
    ...(session.targetClimb ? [{ label: "D+", value: `≈ ${session.targetClimb} m` }] : []),
  ];

  return (
    <main className="screen bare" style={{ display: "flex", flexDirection: "column" }}>
      <Lanes />
      <div className="top-bar">
        <Link href={`/plan?semaine=${session.week}`} className="round" aria-label="Retour au plan"><Icon name="back" size={20} /></Link>
        <span className="mono" style={{ fontSize: 12, border: "1.5px solid var(--ink)", borderRadius: 14, padding: "4px 12px" }}>S{session.week} · séance {session.position + 1} / {count}</span>
      </div>

      <span className="label" style={{ alignSelf: "flex-start", marginTop: 22, padding: "3px 10px", borderRadius: 8, fontSize: 10, background: session.kind === "course" ? "var(--volt)" : "var(--ink)", color: session.kind === "course" ? "var(--ink)" : "var(--volt)" }}>
        {session.kind === "course" ? "Course" : "Renfo"}
      </span>
      <h1 className="display" style={{ fontSize: 32, marginTop: 10 }}>{session.title}</h1>
      <p className="muted" style={{ margin: "6px 0 0", fontSize: 14 }}>{session.summary}</p>
      {session.adjusted && adjustment ? (
        <p className="mono" style={{ margin: "8px 0 0", fontSize: 12 }}>Ajustée : {adjustment.reason}</p>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`, gap: 8, marginTop: 20 }}>
        {stats.map((s, i) => (
          <div key={s.label} className={i === 0 ? "stat volt" : "stat"}>
            <span className="label">{s.label}</span>
            <span className="display" style={{ fontSize: stats.length > 2 ? 17 : 22, whiteSpace: "nowrap" }}>{s.value}</span>
          </div>
        ))}
      </div>

      {session.status === "done" ? (
        <div className="galet" style={{ marginTop: 14, borderRadius: 22, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 30, height: 30, flex: "none", borderRadius: "50%", background: "var(--ink)", color: "var(--volt)", display: "grid", placeItems: "center" }}><Icon name="check" size={16} strokeWidth={3} /></span>
          <span style={{ display: "grid", gap: 2 }}>
            <strong>Faite</strong>
            <span className="mono" style={{ fontSize: 12 }}>{planLine(session)}</span>
            {session.activityId ? <span className="muted" style={{ fontSize: 12 }}>importée d&apos;intervals.icu · ajoute ton ressenti avec « Corriger »</span> : null}
            {session.note ? <span className="muted" style={{ fontSize: 13 }}>{session.note}</span> : null}
          </span>
        </div>
      ) : null}

      <span className="field-label">{session.kind === "course" ? "Déroulé" : "Exercices"}</span>
      <div style={{ display: "grid", gap: 8 }}>
        {session.blocks.map((b, i) => {
          const link = links.get(b.label);
          if (link) {
            return (
              <Link key={i} href={`/exercices/${link.id}?retour=/plan/${session.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 16px 6px 12px", borderRadius: 18, background: "var(--white)", border: "1px solid var(--line)" }}>
                <BodyMap view={bestView(link.muscles)} highlight={link.muscles} height={60} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 900, fontSize: 15 }}>{b.label}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{b.detail}</span>
                </span>
                <span className="mono" style={{ fontSize: 14, flex: "none" }}>{b.duration}</span>
                <Icon name="chevron" size={16} />
              </Link>
            );
          }
          return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 18, background: "var(--white)", border: "1px solid var(--line)" }}>
            <span className="mono" style={{ width: 30, height: 30, flex: "none", borderRadius: "50%", background: i === 0 ? "var(--volt)" : "var(--ink)", color: i === 0 ? "var(--ink)" : "var(--volt)", border: i === 0 ? "1.5px solid var(--ink)" : 0, display: "grid", placeItems: "center", fontSize: 11 }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 900, fontSize: 15 }}>{b.label}</span>
              <span className="muted" style={{ fontSize: 12 }}>{b.detail}</span>
            </span>
            <span className="mono" style={{ fontSize: 14, flex: "none" }}>{b.duration}</span>
          </div>
          );
        })}
      </div>
      {links.size > 0 ? <p className="muted" style={{ margin: "8px 0 0", fontSize: 12 }}>Touche un exercice pour voir comment le faire.</p> : null}

      <div className="galet ink" style={{ marginTop: 14, borderRadius: 22, padding: "14px 18px", fontSize: 13, lineHeight: 1.45 }}>
        <strong style={{ color: "var(--volt)" }}>Pourquoi</strong> — {session.why}
      </div>

      {glossary.length > 0 ? (
        <>
          <span className="field-label">Les mots de la séance</span>
          <div className="settings" style={{ padding: "4px 0" }}>
            {glossary.map((g) => (
              <details key={g.term} style={{ padding: "12px 18px", borderTop: "1px solid var(--line)" }}>
                <summary style={{ listStyle: "none", fontWeight: 900, fontSize: 15, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  {g.term} <Icon name="chevron" size={16} />
                </summary>
                <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5 }}>{g.text}</p>
              </details>
            ))}
          </div>
        </>
      ) : null}

      <div style={{ marginTop: "auto", paddingTop: 22 }}>
        {session.status === "todo" ? (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)", gap: 10 }}>
            <form action={setPlanStatusAction}>
              <input type="hidden" name="id" value={session.id} />
              <input type="hidden" name="status" value="skipped" />
              <button type="submit" className="btn" style={{ width: "100%", height: 56, borderRadius: 28, background: "transparent", color: "var(--ink)", border: "1.5px solid var(--ink)" }}>Pas faite</button>
            </form>
            <ReportSheet session={session} label="Je l'ai faite" />
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: session.status === "done" ? "minmax(0, 1fr) minmax(0, 1.4fr)" : "1fr", gap: 10 }}>
            {session.status === "done" ? (
              <ConfirmDelete
                action={setPlanStatusAction}
                fields={{ id: session.id, status: "todo" }}
                title="Remettre la séance à faire ?"
                message="Le ressenti, la durée, la distance et la note saisis pour cette séance seront effacés."
                confirmLabel="Effacer et remettre à faire"
                className="btn"
                style={{ width: "100%", height: 56, borderRadius: 28, background: "transparent", color: "var(--ink)", border: "1.5px solid var(--ink)" }}
              >
                <Icon name="restart" size={18} /> À refaire
              </ConfirmDelete>
            ) : (
              <form action={setPlanStatusAction}>
                <input type="hidden" name="id" value={session.id} />
                <input type="hidden" name="status" value="todo" />
                <button type="submit" className="btn" style={{ width: "100%", height: 56, borderRadius: 28, background: "transparent", color: "var(--ink)", border: "1.5px solid var(--ink)" }}>
                  <Icon name="restart" size={18} /> Remettre à faire
                </button>
              </form>
            )}
            {session.status === "done" ? <ReportSheet session={session} label="Corriger" /> : null}
          </div>
        )}
      </div>
    </main>
  );
}
