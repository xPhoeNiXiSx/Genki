import Link from "next/link";
import { notFound } from "next/navigation";

import { getExercise } from "@/lib/exercises";
import { muscleLabel } from "@/lib/muscles";

import { databaseBlocker } from "../../db-screens";
import { BodyMap } from "../../ui/body-map";
import { Icon } from "../../ui/icons";
import { Lanes } from "../../ui/lanes";
import { setExerciseActiveAction } from "../actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;

  const { id } = await params;
  const exercise = UUID.test(id) ? await getExercise(id) : null;
  if (!exercise) notFound();

  return (
    <main className="screen bare">
      <Lanes />
      <div className="top-bar">
        <Link href="/exercices" className="round" aria-label="Retour aux exercices"><Icon name="back" size={20} /></Link>
        <Link href={`/exercices/${exercise.id}/modifier`} className="round" aria-label="Modifier l'exercice"><Icon name="edit" size={18} /></Link>
      </div>

      {exercise.active ? null : (
        <form action={setExerciseActiveAction} className="galet" style={{ marginTop: 18, borderRadius: 28, borderStyle: "dashed", display: "flex", alignItems: "center", gap: 12, padding: "12px 12px 12px 18px" }}>
          <input type="hidden" name="id" value={exercise.id} />
          <input type="hidden" name="active" value="1" />
          <span style={{ flex: 1, fontSize: 13 }}>
            <strong style={{ display: "block" }}>Exercice désactivé</strong>
            <span className="muted">Il n&apos;est plus proposé dans les séances.</span>
          </span>
          <button type="submit" className="btn volt" style={{ height: 40, padding: "0 16px", fontSize: 14 }}>Réactiver</button>
        </form>
      )}

      <span className="tag" style={{ marginTop: 18 }}>{exercise.category}</span>
      <h1 className="display" style={{ fontSize: 26, lineHeight: 1.08, marginTop: 12 }}>{exercise.name}</h1>

      <section className="galet" style={{ borderRadius: 32, marginTop: 18, position: "relative", padding: "16px 18px 18px" }} aria-label="Muscles sollicités">
        <span className="display" aria-hidden="true" style={{ position: "absolute", top: 14, right: 18, fontSize: 14, opacity: 0.25 }}>筋肉</span>
        <div style={{ display: "flex", justifyContent: "space-around" }}>
          {(["face", "dos"] as const).map((view) => (
            <figure key={view} style={{ margin: 0, display: "grid", justifyItems: "center", gap: 4 }}>
              <BodyMap view={view} highlight={exercise.muscles} height={262} label={`Vue de ${view}`} />
              <figcaption className="mono muted" style={{ fontSize: 10, letterSpacing: "0.1em" }}>{view === "face" ? "FACE" : "DOS"}</figcaption>
            </figure>
          ))}
        </div>
        {exercise.muscles.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "flex", flexWrap: "wrap", gap: "8px 22px" }}>
            {exercise.muscles.map((m) => (
              <li key={m} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14 }}>
                <span className="dot" aria-hidden="true" /> {muscleLabel(m)}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {exercise.imageUrl ? (
        // Image externe choisie par l'utilisateur : pas d'optimisation Next.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={exercise.imageUrl} alt={`Mouvement : ${exercise.name}`} style={{ width: "100%", marginTop: 14, borderRadius: "32px 14px 32px 14px", display: "block" }} />
      ) : null}

      {exercise.description ? (
        <>
          <h2 className="section">Description</h2>
          <p style={{ margin: 0, lineHeight: 1.45, fontSize: 14, opacity: 0.85 }}>{exercise.description}</p>
        </>
      ) : null}

      <p className="mono muted" style={{ marginTop: 18, fontSize: 11, letterSpacing: "0.06em" }}>
        MATÉRIEL · {(exercise.equipment ?? "aucun").toUpperCase()}
      </p>
    </main>
  );
}
