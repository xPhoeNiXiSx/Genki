import Link from "next/link";
import { notFound } from "next/navigation";

import { sinceLabel } from "@/lib/dates";
import { formatClock, formatLength } from "@/lib/duration";
import { getProgram, listPrograms, roundSeconds } from "@/lib/programs";

import { databaseBlocker } from "../../db-screens";
import { Icon } from "../../ui/icons";
import { Lanes } from "../../ui/lanes";
import { StepRow } from "../../ui/step-row";
import { deleteProgramAction, duplicateProgramAction } from "../actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;

  const { id } = await params;
  const program = UUID.test(id) ? await getProgram(id) : null;
  if (!program) notFound();

  const summaries = await listPrograms();
  const index = summaries.findIndex((p) => p.id === program.id);
  const band = index === 0 ? "Séance du jour" : sinceLabel(summaries[index]?.lastDoneAt ?? null);
  const perRound = roundSeconds(program.steps);
  const total = perRound * program.rounds;
  const meta = [program.category, `${program.steps.length} étape${program.steps.length > 1 ? "s" : ""}`, program.rounds > 1 ? `${program.rounds} tours` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="screen bare">
      <Lanes />
      <div className="top-bar">
        <Link href="/programmes" className="round" aria-label="Retour aux programmes"><Icon name="back" size={20} /></Link>
        <details style={{ position: "relative" }}>
          <summary className="round" aria-label="Plus d'actions" style={{ listStyle: "none" }}><Icon name="more" size={20} /></summary>
          <div className="galet" style={{ position: "absolute", right: 0, top: 52, zIndex: 20, padding: 8, display: "grid", gap: 4, minWidth: 210, borderRadius: 20, boxShadow: "0 10px 24px rgba(26,26,29,.15)" }}>
            <form action={duplicateProgramAction}>
              <input type="hidden" name="id" value={program.id} />
              <button type="submit" className="setting-row" style={{ minHeight: 44, padding: "8px 12px" }}>
                <span style={{ fontWeight: 700 }}>Dupliquer</span> <Icon name="copy" size={18} />
              </button>
            </form>
            <form action={deleteProgramAction}>
              <input type="hidden" name="id" value={program.id} />
              <button type="submit" className="setting-row" style={{ minHeight: 44, padding: "8px 12px", color: "var(--danger)" }}>
                <span style={{ fontWeight: 700 }}>Supprimer</span> <Icon name="trash" size={18} />
              </button>
            </form>
          </div>
        </details>
      </div>

      <article className="bib tilted" style={{ marginTop: 22, transform: "rotate(-1.5deg)" }}>
        <div className="bib-band">
          <span className="mono" style={{ fontSize: 11, fontWeight: 500 }}>N° {String(Math.max(1, index + 1)).padStart(2, "0")}</span>
          <span className="label" style={{ fontSize: 10 }}>{band}</span>
        </div>
        <div className="bib-body" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}>
          <div style={{ minWidth: 0 }}>
            <h1 className="display" style={{ fontSize: 22, lineHeight: 1.12 }}>{program.name}</h1>
            <p className="mono muted" style={{ margin: "6px 0 12px", fontSize: 12 }}>{meta}</p>
            <div style={{ display: "flex", gap: 3 }} aria-hidden="true">
              {program.steps.map((step, i) => (
                <span key={i} style={{ flex: step.durationSeconds, height: 8, borderRadius: 4, background: step.kind === "rest" ? "var(--soft)" : "var(--ink)" }} />
              ))}
            </div>
          </div>
          <Link href={`/seance/${program.id}`} className="round ink" style={{ width: 52, height: 52 }} aria-label={`Lancer ${program.name}`}>
            <Icon name="play" size={18} />
          </Link>
        </div>
      </article>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 22 }}>
        <div className="stat volt">
          <span className="label">Durée</span>
          <span className="display" style={{ fontSize: 24 }}>{formatClock(total)}</span>
        </div>
        <div className="stat">
          <span className="label">Étapes</span>
          <span className="display" style={{ fontSize: 24 }}>{program.steps.length}</span>
        </div>
        <div className="stat">
          <span className="label">Tours</span>
          <span className="display" style={{ fontSize: 24 }}>×{program.rounds}</span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "24px 0 10px" }}>
        <span className="label" style={{ color: "var(--grey)" }}>Étapes{program.rounds > 1 ? " · un tour" : ""}</span>
        {program.rounds > 1 ? <span className="mono muted" style={{ fontSize: 11 }}>≈ {formatLength(perRound)} / tour</span> : null}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {program.steps.map((step, i) => (
          <StepRow key={i} kind={step.kind} n={i + 1} name={step.name} muscles={step.muscles} durationSeconds={step.durationSeconds} />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 10, marginTop: 22, position: "sticky", bottom: "calc(env(safe-area-inset-bottom) + 14px)" }}>
        <Link href={`/programmes/${program.id}/modifier`} className="btn volt" style={{ background: "var(--paper)", height: 56, borderRadius: 28 }}>
          <Icon name="edit" size={18} /> Modifier
        </Link>
        <Link href={`/seance/${program.id}`} className="btn volt" style={{ height: 56, borderRadius: 28 }}>
          <Icon name="play" size={16} /> Lancer la séance
        </Link>
      </div>
    </main>
  );
}
