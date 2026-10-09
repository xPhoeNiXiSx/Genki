import Link from "next/link";
import { notFound } from "next/navigation";

import { longDate } from "@/lib/dates";
import { formatClock } from "@/lib/duration";
import { getProgram, sessionSteps } from "@/lib/programs";
import { getWorkout } from "@/lib/workouts";

import { databaseBlocker } from "../../db-screens";
import { Icon } from "../../ui/icons";
import { Lanes } from "../../ui/lanes";
import { StepRow } from "../../ui/step-row";
import { deleteWorkoutAction } from "../actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHOWN_STEPS = 5;

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;

  const { id } = await params;
  const workout = UUID.test(id) ? await getWorkout(id) : null;
  if (!workout) notFound();

  // Les étapes réalisées sont reconstituées depuis le programme, s'il existe
  // encore : les premières étapes de la séance, dans l'ordre joué.
  const program = workout.programId ? await getProgram(workout.programId) : null;
  const played = program ? sessionSteps(program.steps, program.rounds) : [];
  const done = played.slice(0, workout.stepsDone ?? (workout.completed ? played.length : 0));
  const total = workout.stepsTotal ?? played.length;

  const steps = (list: typeof done, from: number) =>
    list.map((s, i) => <StepRow key={from + i} kind={s.kind} n={from + i + 1} name={s.name} muscles={s.muscles} durationSeconds={s.durationSeconds} />);

  return (
    <main className="screen bare">
      <Lanes />
      <div className="top-bar">
        <Link href="/suivi" className="round" aria-label="Retour au suivi"><Icon name="back" size={20} /></Link>
        <details style={{ position: "relative" }}>
          <summary className="round" aria-label="Plus d'actions" style={{ listStyle: "none" }}><Icon name="more" size={20} /></summary>
          <form action={deleteWorkoutAction} className="galet" style={{ position: "absolute", right: 0, top: 52, zIndex: 20, padding: 8, minWidth: 230, borderRadius: 20, boxShadow: "0 10px 24px rgba(26,26,29,.15)" }}>
            <input type="hidden" name="id" value={workout.id} />
            <button type="submit" className="setting-row" style={{ minHeight: 44, padding: "8px 12px", color: "var(--danger)" }}>
              <span style={{ fontWeight: 700 }}>Supprimer la séance</span> <Icon name="trash" size={18} />
            </button>
          </form>
        </details>
      </div>

      <p className="label" style={{ margin: "18px 0 6px", opacity: 0.7 }}>{longDate(workout.startedAt)}</p>
      <h1 className="display" style={{ fontSize: 34, lineHeight: 1.08 }}>{workout.programName}</h1>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
        <span className="subtitle" style={{ margin: 0 }}>きろく · séance du carnet</span>
        <span className="chip" style={{ height: 26, fontSize: 11, background: workout.completed ? "var(--volt)" : "transparent", borderColor: workout.completed ? "var(--ink)" : undefined }}>
          {workout.completed ? "Terminée" : "Interrompue"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 20 }}>
        <div className="stat" style={{ background: "var(--ink)", borderColor: "var(--ink)", color: "var(--white)" }}>
          <span className="label" style={{ color: "var(--volt)" }}>Durée</span>
          <span className="display" style={{ fontSize: 22 }}>{formatClock(workout.durationSeconds)}</span>
        </div>
        <div className="stat">
          <span className="label">Étapes</span>
          <span className="display" style={{ fontSize: 22 }}>{total ? `${workout.stepsDone ?? done.length}/${total}` : "—"}</span>
        </div>
        <div className="stat volt">
          <span className="label">Ressenti</span>
          <span className="display" style={{ fontSize: 22 }}>{workout.feeling ? `${workout.feeling}/5` : "—"}</span>
        </div>
      </div>

      {workout.note ? (
        <section className="galet" style={{ marginTop: 14, background: "var(--stone)", borderColor: "var(--stone)", borderRadius: 24 }}>
          <p className="label" style={{ margin: "0 0 6px", opacity: 0.7 }}>Note pour le kiné</p>
          <p style={{ margin: 0, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{workout.note}</p>
        </section>
      ) : null}

      {done.length > 0 ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "24px 0 10px" }}>
            <span className="label" style={{ color: "var(--grey)" }}>Étapes réalisées</span>
            <span className="mono muted" style={{ fontSize: 11 }}>{done.length} sur {total}</span>
          </div>
          <div style={{ display: "grid", gap: 8 }}>{steps(done.slice(0, SHOWN_STEPS), 0)}</div>
          {done.length > SHOWN_STEPS ? (
            <details>
              <summary className="muted" style={{ listStyle: "none", textAlign: "center", padding: 12, fontWeight: 700, cursor: "pointer" }}>
                + {done.length - SHOWN_STEPS} autre{done.length - SHOWN_STEPS > 1 ? "s" : ""} étape{done.length - SHOWN_STEPS > 1 ? "s" : ""}
              </summary>
              <div style={{ display: "grid", gap: 8 }}>{steps(done.slice(SHOWN_STEPS), SHOWN_STEPS)}</div>
            </details>
          ) : null}
        </>
      ) : null}

      {program ? (
        <Link href={`/seance/${program.id}`} className="btn volt wide" style={{ marginTop: 20 }}>
          <Icon name="restart" size={18} /> Relancer ce programme
        </Link>
      ) : (
        <p className="muted" style={{ marginTop: 20, textAlign: "center", fontSize: 13 }}>Le programme de cette séance a été supprimé.</p>
      )}
    </main>
  );
}
